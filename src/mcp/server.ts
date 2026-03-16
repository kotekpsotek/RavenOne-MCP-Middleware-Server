import { Router } from "express";
import { extractServerNames, extractToolInvocations, readMCPConfigOrStatus, withMCPClientForServer } from "./mcp.calling.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { MCPServerToolsMap, MCPToolOutput } from "@ravenlens/backend/mcp-interface";

export const MCPCallingRouter = Router();
export default MCPCallingRouter;

MCPCallingRouter.post("/mcp-servers-list", async (req, res) => {
    const readConfigResult = readMCPConfigOrStatus();
    if (!readConfigResult.ok) {
        res.status(readConfigResult.status).json({ message: readConfigResult.message });
        return;
    }

    const servers = Object.keys(readConfigResult.config.mcpServers);
    res.status(200).json(servers);
})

MCPCallingRouter.post("/get-mcp-servers-tools", async (req, res) => {
    const serverNames = extractServerNames(req.body);
    if (!serverNames || !serverNames.length) {
        res.status(400).json({ message: "Body must contain serverNames: string[]." });
        return;
    }

    const readConfigResult = readMCPConfigOrStatus();
    if (!readConfigResult.ok) {
        res.status(readConfigResult.status).json({ message: readConfigResult.message });
        return;
    }

    const uniqueServerNames = [...new Set(serverNames)];
    const missingServers = uniqueServerNames.filter((serverName) => !readConfigResult.config.mcpServers[serverName]);
    if (missingServers.length) {
        res.status(400).json({
            message: "Some requested MCP servers are missing in mcpConfig.",
            missingServers,
        });
        return;
    }

    const serverToolEntries = await Promise.all(
        uniqueServerNames.map(async (serverName) => {
            const tools = await withMCPClientForServer(serverName, readConfigResult.config, async (client) => {
                const listToolsResult = await client.listTools();
                return listToolsResult.tools;
            });

            return [serverName, tools] as const;
        }),
    );

    const toolsByServer = Object.fromEntries(serverToolEntries) as MCPServerToolsMap;
    res.status(200).json(toolsByServer);
})

MCPCallingRouter.post(["/call-tools", "/call-tool"], async (req, res) => {
    const tools = extractToolInvocations(req.body);
    if (!tools || !tools.length) {
        res.status(400).json({ message: "Body must contain tools: MCP tool calls array." });
        return;
    }

    const readConfigResult = readMCPConfigOrStatus();
    if (!readConfigResult.ok) {
        res.status(readConfigResult.status).json({ message: readConfigResult.message });
        return;
    }

    const uniqueServerNames = [...new Set(tools.map((tool) => tool.serverName))];
    const missingServers = uniqueServerNames.filter((serverName) => !readConfigResult.config.mcpServers[serverName]);
    if (missingServers.length) {
        res.status(400).json({
            message: "Some tool calls target MCP servers missing in mcpConfig.",
            missingServers,
        });
        return;
    }

    const outputs = await Promise.all(
        tools.map(async (tool): Promise<MCPToolOutput> => {
            try {
                const output = await withMCPClientForServer(tool.serverName, readConfigResult.config, async (client) => {
                    const toolCallResult = await client.callTool({
                        name: tool.name,
                        arguments: tool.arguments,
                        _meta: tool._meta,
                        task: tool.task,
                    });

                    if ("toolResult" in toolCallResult) {
                        return {
                            content: [{ type: "text", text: JSON.stringify(toolCallResult.toolResult) }],
                            isError: false,
                        } satisfies CallToolResult;
                    }

                    return toolCallResult;
                });

                return {
                    toolName: tool.name,
                    output,
                };
            } catch (error) {
                return {
                    toolName: tool.name,
                    output: {
                        error: error instanceof Error ? error.message : "Unknown tool execution error",
                    },
                };
            }
        }),
    );

    res.status(200).json(outputs);
})
