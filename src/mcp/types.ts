export type MCPToolInvocation = {
    serverName: string;
    name: string;
    arguments?: Record<string, unknown>;
    _meta?: Record<string, unknown>;
    task?: {
        ttl?: number;
    };
};

export type MCPToolOutput = {
    toolName: string;
    output: unknown;
};

export type MCPServerToolsMap = Record<string, unknown>;