import "dotenv/config";
import { describe, it, expect } from "vitest";
import { MCPConfigInterface } from "../src/interface/config.js";

describe("'MCPConfigInterface' testing", () => {
    const McpConfigInterface = new MCPConfigInterface();
    
    it("read", () => {
        const content = McpConfigInterface.read();
        expect(content.length).toBeGreaterThan(1);
    })

    it("write", () => {
        const originalContent = McpConfigInterface.read();
        const testConfig = JSON.stringify({ mcpServers: { test: { command: "echo" } } });
        
        McpConfigInterface.write(testConfig);
        const newContent = McpConfigInterface.read();
        expect(newContent).toBe(testConfig);

        // Restore original content
        if (originalContent) {
            McpConfigInterface.write(originalContent);
        }
    })

    it("checkIsValidMCPConfig", () => {
        const validConfig = JSON.stringify({
            mcpServers: {
                testServer: {
                    command: "node",
                    args: ["index.js"],
                    env: {
                        TEST: "true"
                    }
                }
            }
        });

        const invalidConfigFormat = "not a valid json string";
        const invalidConfigNoServers = JSON.stringify({ somethingElse: {} });
        const invalidCommandType = JSON.stringify({
            mcpServers: {
                testServer: {
                    command: 123
                }
            }
        });

        expect(McpConfigInterface.checkIsValidMCPConfig(validConfig)).toBe(true);
        expect(McpConfigInterface.checkIsValidMCPConfig(invalidConfigFormat)).toBe(false);
        expect(McpConfigInterface.checkIsValidMCPConfig(invalidConfigNoServers)).toBe(false);
        expect(McpConfigInterface.checkIsValidMCPConfig(invalidCommandType)).toBe(false);
    })
});
