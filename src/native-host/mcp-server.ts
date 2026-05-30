import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { z } from "zod/v4"
import type { Bridge } from "./bridge.js"

const VERBOSE = process.env.LOG_LEVEL === "debug"
const log = (msg: string) => { if (VERBOSE) console.error(msg) }

function createServer(bridge: Bridge) {
  const server = new McpServer({ name: "opencode-browser", version: "1.0.0" })

  server.registerTool("browser_list_tabs", { description: "List open browser tabs", inputSchema: {} }, async () => {
    log("[mcp] list_tabs")
    const r = await bridge.call("list_tabs", {})
    return { content: [{ type: "text" as const, text: JSON.stringify(r, null, 2) }] }
  })

  server.registerTool("browser_read_page_html", { description: "Read HTML of a tab", inputSchema: { tabId: z.number() } }, async (a) => {
    const r = await bridge.call("read_page_html", { tabId: a.tabId })
    return { content: [{ type: "text" as const, text: typeof r === "string" ? r : JSON.stringify(r) }] }
  })

  server.registerTool("browser_execute_js", { description: "Execute JS in a tab", inputSchema: { tabId: z.number(), code: z.string() } }, async (a) => {
    const r = await bridge.call("execute_js", { tabId: a.tabId, code: a.code })
    return { content: [{ type: "text" as const, text: JSON.stringify(r, null, 2) }] }
  })

  server.registerTool("browser_take_screenshot", { description: "Screenshot a tab", inputSchema: { tabId: z.number().optional() } }, async (a) => {
    const r = await bridge.call("take_screenshot", { tabId: a.tabId })
    return { content: [{ type: "text" as const, text: String(r) }] }
  })

  server.registerTool("browser_navigate", { description: "Navigate tab to URL", inputSchema: { tabId: z.number(), url: z.string() } }, async (a) => {
    const r = await bridge.call("navigate", { tabId: a.tabId, url: a.url })
    return { content: [{ type: "text" as const, text: JSON.stringify(r, null, 2) }] }
  })

  return server
}

export async function handleMcpRequest(bridge: Bridge, req: Request): Promise<Response> {
  const server = createServer(bridge)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)
  const response = await transport.handleRequest(req)
  return response
}
