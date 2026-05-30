import { Bridge } from "./bridge.js"
import { onMessage, sendMessage } from "./native-messaging.js"
import { createMcpServer } from "./mcp-server.js"

const PORT = 19877
const bridge = new Bridge()

bridge.setSend(sendMessage)
onMessage((msg) => {
  if (msg && typeof msg === "object" && "id" in msg) {
    bridge.handleResponse(msg as { id: string; result?: unknown; error?: string })
  }
})

const { server, transport } = createMcpServer(bridge)

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname.startsWith("/mcp")) {
      return transport.handleRequest(req)
    }
    return new Response("opencode-native-host", { status: 200 })
  },
})

console.error(`MCP server listening on http://127.0.0.1:${PORT}/mcp`)

server.connect(transport)

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
process.stdin.on("end", shutdown)
process.stdin.on("close", shutdown)

function shutdown() {
  bridge.destroy()
  process.exit(0)
}
