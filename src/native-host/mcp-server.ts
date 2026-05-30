import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { z } from "zod/v4"
import type { Bridge } from "./bridge.js"

const VERBOSE = process.env.LOG_LEVEL === "debug"
const log = (msg: string) => { if (VERBOSE) console.error(msg) }

function createTransport() {
  return new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
}

export function createMcpServer(bridge: Bridge): {
  server: McpServer
  handleRequest: (req: Request) => Promise<Response>
} {
  const handleRequest = async (req: Request) => {
    const server = new McpServer({ name: "opencode-browser", version: "1.0.0" })

    server.registerTool(
      "browser_list_tabs",
      { description: "List all open browser tabs with their IDs, URLs, and titles", inputSchema: {} },
      async () => {
        log("[mcp] list_tabs called")
        const result = await bridge.call("list_tabs", {})
        log(`[mcp] list_tabs done, ${Array.isArray(result) ? result.length : 0} tabs`)
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      },
    )

    server.registerTool(
      "browser_read_page_html",
      {
        description: "Read the full HTML content of a browser tab",
        inputSchema: { tabId: z.number().describe("The ID of the tab to read HTML from") },
      },
      async (args) => {
        log(`[mcp] read_page_html tabId=${args.tabId}`)
        const result = await bridge.call("read_page_html", { tabId: args.tabId })
        const size = typeof result === "string" ? result.length : 0
        log(`[mcp] read_page_html done, ${size} chars`)
        return { content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result) }] }
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
        log(`[mcp] execute_js tabId=${args.tabId}`)
        const result = await bridge.call("execute_js", { tabId: args.tabId, code: args.code })
        log(`[mcp] execute_js done`)
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      },
    )

    server.registerTool(
      "browser_take_screenshot",
      {
        description: "Take a screenshot of the visible area of a browser tab",
        inputSchema: { tabId: z.number().optional().describe("The ID of the tab to screenshot (defaults to active tab)") },
      },
      async (args) => {
        log(`[mcp] take_screenshot tabId=${args.tabId ?? "active"}`)
        const result = await bridge.call("take_screenshot", { tabId: args.tabId })
        log(`[mcp] take_screenshot done`)
        return { content: [{ type: "text" as const, text: String(result) }] }
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
        log(`[mcp] navigate tabId=${args.tabId}`)
        const result = await bridge.call("navigate", { tabId: args.tabId, url: args.url })
        log(`[mcp] navigate done`)
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      },
    )

    const transport = createTransport()
    await server.connect(transport)
    return transport.handleRequest(req)
  }

  return { handleRequest }
}
