import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
    StdioClientTransport,
    type StdioServerParameters,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import type { MCPToolInvocation, MCPServerToolsMap, MCPToolOutput } from "@ravenlens/backend/mcp-interface";
import { MCPConfigInterface } from "../interface/config.js";

type MCPConfigJSON = {
    mcpServers: Record<string, StdioServerParameters>;
};

export type { MCPServerToolsMap, MCPToolOutput };

const MCP_CLIENT_IMPLEMENTATION = {
    name: "mcp-client-middleware-server",
    version: "1.0.0",
};

function summarizeServerCommand(serverConfig: StdioServerParameters): string {
    const serializedArgs = Array.isArray(serverConfig.args) && serverConfig.args.length
        ? ` ${serverConfig.args.join(" ")}`
        : "";

    return `${serverConfig.command}${serializedArgs}`;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function readMCPConfigOrStatus():
    | { ok: true; config: MCPConfigJSON }
    | { ok: false; status: number; message: string } {
    const mcpConfigRaw = new MCPConfigInterface().read();

    if (!mcpConfigRaw.length) {
        return {
            ok: false,
            status: 404,
            message: "MCP configuration file was not found.",
        };
    }

    try {
        const parsedConfig = JSON.parse(mcpConfigRaw) as Partial<MCPConfigJSON>;
        if (!parsedConfig.mcpServers || typeof parsedConfig.mcpServers !== "object") {
            return {
                ok: false,
                status: 400,
                message: "MCP configuration is missing the mcpServers object.",
            };
        }

        return {
            ok: true,
            config: parsedConfig as MCPConfigJSON,
        };
    } catch {
        return {
            ok: false,
            status: 400,
            message: "MCP configuration is not a valid JSON.",
        };
    }
}

export function extractServerNames(body: unknown): string[] | undefined {
    if (Array.isArray(body) && body.every((value) => typeof value === "string")) {
        return body;
    }

    if (
        typeof body === "object"
        && body !== null
        && Array.isArray((body as { serverNames?: unknown[] }).serverNames)
        && (body as { serverNames: unknown[] }).serverNames.every((value) => typeof value === "string")
    ) {
        return (body as { serverNames: string[] }).serverNames;
    }

    return undefined;
}

export function isMCPToolInvocation(value: unknown): value is MCPToolInvocation {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Partial<MCPToolInvocation>;
    if (typeof candidate.serverName !== "string") {
        return false;
    }

    if (typeof candidate.name !== "string") {
        return false;
    }

    if (
        candidate.arguments !== undefined
        && (
            typeof candidate.arguments !== "object"
            || candidate.arguments === null
            || Array.isArray(candidate.arguments)
        )
    ) {
        return false;
    }

    return true;
}

export function extractToolInvocations(body: unknown): MCPToolInvocation[] | undefined {
    if (Array.isArray(body) && body.every((value) => isMCPToolInvocation(value))) {
        return body;
    }

    if (
        typeof body === "object"
        && body !== null
        && Array.isArray((body as { tools?: unknown[] }).tools)
        && (body as { tools: unknown[] }).tools.every((value) => isMCPToolInvocation(value))
    ) {
        return (body as { tools: MCPToolInvocation[] }).tools;
    }

    return undefined;
}

export async function withMCPClientForServer<T>(
    serverName: string,
    config: MCPConfigJSON,
    run: (client: Client) => Promise<T>,
): Promise<T> {
    const serverConfig = config.mcpServers[serverName];
    if (!serverConfig) {
        throw new Error(`MCP server \"${serverName}\" is missing in configuration.`);
    }

    const transport = new StdioClientTransport(serverConfig);
    const client = new Client(MCP_CLIENT_IMPLEMENTATION);
    const commandSummary = summarizeServerCommand(serverConfig);

    try {
        await client.connect(transport);
        return await run(client);
    } catch (error) {
        const message = errorMessage(error);
        if (message.includes("Connection closed")) {
            throw new Error(
                `MCP server "${serverName}" closed the stdio connection. Ensure the command starts a long-running MCP server process and does not exit immediately. Command: ${commandSummary}. Original error: ${message}`,
            );
        }

        throw new Error(
            `MCP request failed for server "${serverName}". Command: ${commandSummary}. Error: ${message}`,
        );
    } finally {
        await Promise.allSettled([
            client.close(),
            transport.close(),
        ]);
    }
}
