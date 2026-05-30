import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { z } from "zod/v4"
import type { Bridge } from "./bridge.js"

export function createMcpServer(bridge: Bridge): { server: McpServer; transport: WebStandardStreamableHTTPServerTransport } {
  const server = new McpServer({
    name: "opencode-browser",
    version: "1.0.0",
  })

  server.registerTool(
    "browser_list_tabs",
    {
      description: "List all open browser tabs with their IDs, URLs, and titles",
      inputSchema: {},
    },
    async () => {
      const result = await bridge.call("list_tabs", {})
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  server.registerTool(
    "browser_read_page_html",
    {
      description: "Read the full HTML content of a browser tab",
      inputSchema: { tabId: z.number().describe("The ID of the tab to read HTML from") },
    },
    async (args) => {
      const result = await bridge.call("read_page_html", { tabId: args.tabId })
      return {
        content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result) }],
      }
    },
  )

  server.registerTool(
    "browser_execute_js",
    {
      description: "Execute JavaScript code in a browser tab and return the result",
      inputSchema: {
        tabId: z.number().describe("The ID of the tab to execute JS in"),
        code: z.string().describe("The JavaScript code to execute"),
      },
    },
    async (args) => {
      const result = await bridge.call("execute_js", { tabId: args.tabId, code: args.code })
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  server.registerTool(
    "browser_take_screenshot",
    {
      description: "Take a screenshot of the visible area of a browser tab",
      inputSchema: {
        tabId: z.number().optional().describe("The ID of the tab to screenshot (defaults to active tab)"),
      },
    },
    async (args) => {
      const result = await bridge.call("take_screenshot", { tabId: args.tabId })
      return {
        content: [{ type: "text" as const, text: String(result) }],
      }
    },
  )

  server.registerTool(
    "browser_navigate",
    {
      description: "Navigate a browser tab to a URL",
      inputSchema: {
        tabId: z.number().describe("The ID of the tab to navigate"),
        url: z.string().describe("The URL to navigate to"),
      },
    },
    async (args) => {
      const result = await bridge.call("navigate", { tabId: args.tabId, url: args.url })
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

  return { server, transport }
}
