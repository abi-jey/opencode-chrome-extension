import { Bridge } from "./bridge.js"
import { onMessage, sendMessage } from "./native-messaging.js"
import { createMcpServer } from "./mcp-server.js"

const PORT = 19877

console.error("[host] starting native messaging host, pid=", process.pid)
console.error("[host] args:", process.argv.slice(1).join(" "))

const bridge = new Bridge()

bridge.setSend(sendMessage)

onMessage((msg) => {
  if (msg && typeof msg === "object" && "id" in msg) {
    bridge.handleResponse(msg as { id: string; result?: unknown; error?: string })
  } else {
    console.error("[host] unknown message:", JSON.stringify(msg).slice(0, 200))
  }
})

const { server, transport } = createMcpServer(bridge)

server.connect(transport).catch((err) => {
  console.error("[host] MCP server connect error:", err)
})

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url)
    console.error(`[host] HTTP ${req.method} ${url.pathname}`)
    if (url.pathname.startsWith("/mcp")) {
      return transport.handleRequest(req)
    }
    return new Response("opencode-native-host", { status: 200 })
  },
})

console.error(`[host] MCP server listening on http://127.0.0.1:${PORT}/mcp`)

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
process.on("uncaughtException", (err) => {
  console.error("[host] uncaught exception:", err)
  shutdown()
})

process.stdin.on("end", () => {
  console.error("[host] stdin ended, shutting down")
  shutdown()
})
process.stdin.on("close", () => {
  console.error("[host] stdin closed, shutting down")
  shutdown()
})

function shutdown() {
  console.error("[host] shutdown")
  bridge.destroy()
  process.exit(0)
}
