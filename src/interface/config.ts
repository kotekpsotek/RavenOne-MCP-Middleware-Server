import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

const defaultConfigFilePath = "./config/mcpConfig.json"

export class MCPConfigInterface {
    configTargetFileENV: string;
    
    constructor() {
        this.configTargetFileENV = process.env["ConfigFilePath"] ?? defaultConfigFilePath;
    }
    
    read(): string {
        if (!fs.existsSync(this.configTargetFileENV)) {
            return "";
        }
        return fs.readFileSync(this.configTargetFileENV, "utf-8");
    }

    checkIsValidMCPConfig(config: string): boolean {
        try {
            // 1. Check if the specified property is a valid JSON object
            const parsedConfig = JSON.parse(config);

            if (typeof parsedConfig !== "object" || parsedConfig === null || Array.isArray(parsedConfig)) {
                return false;
            }

            // 2. Check if the JSON objects are compliant with the Model Context Protocol Schema
            // MCP configs require an "mcpServers" object
            if (!parsedConfig.mcpServers || typeof parsedConfig.mcpServers !== "object") {
                return false;
            }

            // Validate each server configuration inside "mcpServers"
            for (const serverName in parsedConfig.mcpServers) {
                const serverConfig = parsedConfig.mcpServers[serverName];

                if (typeof serverConfig !== "object" || serverConfig === null) {
                    return false;
                }

                // "command" property is required and must be a string
                if (typeof serverConfig.command !== "string") {
                    return false;
                }

                // "args" is optional, but if present must be an array of strings
                if (serverConfig.args !== undefined) {
                    if (!Array.isArray(serverConfig.args)) {
                        return false;
                    }
                    for (const arg of serverConfig.args) {
                        if (typeof arg !== "string") {
                            return false;
                        }
                    }
                }

                // "env" is optional, but if present must be an object with string key/values
                if (serverConfig.env !== undefined) {
                    if (typeof serverConfig.env !== "object" || serverConfig.env === null || Array.isArray(serverConfig.env)) {
                        return false;
                    }
                    for (const envKey in serverConfig.env) {
                        if (typeof serverConfig.env[envKey] !== "string") {
                            return false;
                        }
                    }
                }
            }

            return true;
        } catch (error) {
            // If JSON.parse throws an error, it's not a valid JSON string
            return false;
        }
    }
    
    /**
     * @param toSave - is the json object to save
     */
    write(toSave: string): void {
        const dirPath = path.dirname(this.configTargetFileENV);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.writeFileSync(this.configTargetFileENV, toSave, "utf-8");
    }
}
