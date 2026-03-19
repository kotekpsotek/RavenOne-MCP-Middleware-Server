import type { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";

export type MCPStdioServerConfig = StdioServerParameters & {
    type?: "stdio";
    [key: string]: unknown;
};

export type MCPRemoteServerConfig = {
    type?: string;
    url: string;
    headers?: Record<string, string>;
    [key: string]: unknown;
};

export type MCPServerConfig = MCPStdioServerConfig | MCPRemoteServerConfig;

export type MCPConfigJSON = {
    mcpServers: Record<string, MCPServerConfig>;
    [key: string]: unknown;
};

type ParseResult<T> =
    | {
        ok: true;
        value: T;
    }
    | {
        ok: false;
        error: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStringRecord(value: unknown): value is Record<string, string> {
    return isRecord(value)
        && !Array.isArray(value)
        && Object.values(value).every((recordValue) => typeof recordValue === "string");
}

function isValidURL(url: string): boolean {
    try {
        // URL constructor throws on invalid values.
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function normalizeServerType(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized.length) {
        return undefined;
    }

    if (normalized === "streamablehttp" || normalized === "streamable_http") {
        return "streamable-http";
    }

    return normalized;
}

export function isStdioServerConfig(serverConfig: MCPServerConfig): serverConfig is MCPStdioServerConfig {
    return isNonEmptyString((serverConfig as Record<string, unknown>).command);
}

export function isRemoteServerConfig(serverConfig: MCPServerConfig): serverConfig is MCPRemoteServerConfig {
    return isNonEmptyString((serverConfig as Record<string, unknown>).url);
}

function validateSingleServer(
    serverName: string,
    rawServerConfig: unknown,
): ParseResult<MCPServerConfig> {
    if (!isRecord(rawServerConfig) || Array.isArray(rawServerConfig)) {
        return {
            ok: false,
            error: `Server "${serverName}" must be a JSON object.`,
        };
    }

    const normalizedType = normalizeServerType(rawServerConfig.type);
    const hasCommand = isNonEmptyString(rawServerConfig.command);
    const hasUrl = isNonEmptyString(rawServerConfig.url);

    const forceStdio = normalizedType === "stdio";
    const forceRemote = normalizedType !== undefined && normalizedType !== "stdio";

    if (!hasCommand && !hasUrl) {
        return {
            ok: false,
            error: `Server "${serverName}" must include a non-empty "command" (stdio) or "url" (remote).`,
        };
    }

    const shouldValidateStdio = forceStdio || (!forceRemote && hasCommand);
    if (shouldValidateStdio) {
        if (!hasCommand) {
            return {
                ok: false,
                error: `Server "${serverName}" has type "stdio" and must include a non-empty "command" string.`,
            };
        }

        if (rawServerConfig.args !== undefined && !isStringArray(rawServerConfig.args)) {
            return {
                ok: false,
                error: `Server "${serverName}" has invalid "args". It must be an array of strings when provided.`,
            };
        }

        if (rawServerConfig.env !== undefined && !isStringRecord(rawServerConfig.env)) {
            return {
                ok: false,
                error: `Server "${serverName}" has invalid "env". It must be an object with string values when provided.`,
            };
        }

        return {
            ok: true,
            value: rawServerConfig as MCPStdioServerConfig,
        };
    }

    if (!hasUrl) {
        return {
            ok: false,
            error: `Server "${serverName}" must include a non-empty "url" string for remote transports.`,
        };
    }

    if (!isValidURL(rawServerConfig.url as string)) {
        return {
            ok: false,
            error: `Server "${serverName}" has invalid "url". It must be a valid absolute URL.`,
        };
    }

    if (rawServerConfig.type !== undefined && !isNonEmptyString(rawServerConfig.type)) {
        return {
            ok: false,
            error: `Server "${serverName}" has invalid "type". It must be a non-empty string when provided.`,
        };
    }

    if (rawServerConfig.headers !== undefined && !isStringRecord(rawServerConfig.headers)) {
        return {
            ok: false,
            error: `Server "${serverName}" has invalid "headers". It must be an object with string values when provided.`,
        };
    }

    return {
        ok: true,
        value: rawServerConfig as MCPRemoteServerConfig,
    };
}

function validateMCPConfigObject(rawConfigObject: unknown): ParseResult<MCPConfigJSON> {
    if (!isRecord(rawConfigObject) || Array.isArray(rawConfigObject)) {
        return {
            ok: false,
            error: "Configuration must be a JSON object.",
        };
    }

    const rawServers = rawConfigObject.mcpServers;
    if (!isRecord(rawServers) || Array.isArray(rawServers)) {
        return {
            ok: false,
            error: 'Configuration must contain a "mcpServers" object.',
        };
    }

    const normalizedServers: Record<string, MCPServerConfig> = {};

    for (const [serverName, serverConfig] of Object.entries(rawServers)) {
        const validatedServer = validateSingleServer(serverName, serverConfig);
        if (!validatedServer.ok) {
            return validatedServer;
        }

        normalizedServers[serverName] = validatedServer.value;
    }

    return {
        ok: true,
        value: {
            ...rawConfigObject,
            mcpServers: normalizedServers,
        } as MCPConfigJSON,
    };
}

export function parseMCPConfig(rawConfig: string): ParseResult<MCPConfigJSON> {
    try {
        const parsed = JSON.parse(rawConfig) as unknown;
        return validateMCPConfigObject(parsed);
    } catch {
        return {
            ok: false,
            error: "Configuration must be valid JSON.",
        };
    }
}

export function checkIsValidMCPConfig(rawConfig: string): boolean {
    return parseMCPConfig(rawConfig).ok;
}

export function resolveServerTransport(serverConfig: MCPServerConfig): "stdio" | "streamable-http" | "sse" {
    const normalizedType = normalizeServerType((serverConfig as Record<string, unknown>).type);

    if (normalizedType === "sse") {
        return "sse";
    }

    if (normalizedType === "stdio") {
        return "stdio";
    }

    if (isStdioServerConfig(serverConfig)) {
        return "stdio";
    }

    return "streamable-http";
}