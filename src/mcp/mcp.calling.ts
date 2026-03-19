import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
    StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { MCPToolInvocation, MCPServerToolsMap, MCPToolOutput } from "@ravenlens/backend/mcp-interface";
import { MCPConfigInterface } from "../interface/config.js";
import {
    isRemoteServerConfig,
    isStdioServerConfig,
    parseMCPConfig,
    resolveServerTransport,
    type MCPConfigJSON,
    type MCPRemoteServerConfig,
    type MCPServerConfig,
    type MCPStdioServerConfig,
} from "./config.validation.js";

export type { MCPServerToolsMap, MCPToolOutput };

const MCP_CLIENT_IMPLEMENTATION = {
    name: "mcp-client-middleware-server",
    version: "1.0.0",
};

function summarizeServerCommand(serverConfig: MCPStdioServerConfig): string {
    const serializedArgs = Array.isArray(serverConfig.args) && serverConfig.args.length
        ? ` ${serverConfig.args.join(" ")}`
        : "";

    return `${serverConfig.command}${serializedArgs}`;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function summarizeServerTarget(serverConfig: MCPServerConfig): string {
    const transport = resolveServerTransport(serverConfig);

    if (transport === "stdio" && isStdioServerConfig(serverConfig)) {
        return summarizeServerCommand(serverConfig);
    }

    if (isRemoteServerConfig(serverConfig)) {
        return `${transport.toUpperCase()} ${serverConfig.url}`;
    }

    return transport.toUpperCase();
}

function toHTTPTransportOptions(serverConfig: MCPRemoteServerConfig) {
    const requestInit = serverConfig.headers
        ? { headers: serverConfig.headers }
        : undefined;

    return requestInit ? { requestInit } : undefined;
}

function createTransportForServer(serverName: string, serverConfig: MCPServerConfig) {
    const transport = resolveServerTransport(serverConfig);

    if (transport === "stdio") {
        if (!isStdioServerConfig(serverConfig)) {
            throw new Error(`MCP server "${serverName}" is configured as stdio but lacks a valid "command" string.`);
        }

        return new StdioClientTransport(serverConfig);
    }

    if (!isRemoteServerConfig(serverConfig)) {
        throw new Error(`MCP server "${serverName}" is configured as remote transport but lacks a valid "url" string.`);
    }

    const transportOptions = toHTTPTransportOptions(serverConfig);
    const serverUrl = new URL(serverConfig.url);

    if (transport === "sse") {
        return new SSEClientTransport(serverUrl, transportOptions);
    }

    return new StreamableHTTPClientTransport(serverUrl, transportOptions);
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

    const parsedConfig = parseMCPConfig(mcpConfigRaw);
    if (!parsedConfig.ok) {
        return {
            ok: false,
            status: 400,
            message: `MCP configuration is invalid. ${parsedConfig.error}`,
        };
    }

    return {
        ok: true,
        config: parsedConfig.value,
    };
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

    const transport = createTransportForServer(serverName, serverConfig);
    const client = new Client(MCP_CLIENT_IMPLEMENTATION);
    const targetSummary = summarizeServerTarget(serverConfig);
    const transportKind = resolveServerTransport(serverConfig);

    try {
        await client.connect(transport as unknown as Parameters<Client["connect"]>[0]);
        return await run(client);
    } catch (error) {
        const message = errorMessage(error);
        if (transportKind === "stdio" && message.includes("Connection closed")) {
            throw new Error(
                `MCP server "${serverName}" closed the stdio connection. Ensure the command starts a long-running MCP server process and does not exit immediately. Command: ${targetSummary}. Original error: ${message}`,
            );
        }

        throw new Error(
            `MCP request failed for server "${serverName}" over ${transportKind}. Target: ${targetSummary}. Error: ${message}`,
        );
    } finally {
        await Promise.allSettled([
            client.close(),
            transport.close(),
        ]);
    }
}
