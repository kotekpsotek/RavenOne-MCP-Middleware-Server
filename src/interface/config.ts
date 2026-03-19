import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { checkIsValidMCPConfig } from "../mcp/config.validation.js";

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
        return checkIsValidMCPConfig(config);
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
