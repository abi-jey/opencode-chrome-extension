import { Bridge } from "./bridge.js"
import { onMessage, sendMessage } from "./native-messaging.js"
import { createMcpServer } from "./mcp-server.js"

const PORT = 19877
const VERBOSE = process.env.LOG_LEVEL === "debug"

function log(msg: string) {
  if (!VERBOSE) return
  console.error(msg)
}
function always(msg: string) {
  console.error(msg)
}

always(`[host] starting, pid=${process.pid} verbose=${VERBOSE}`)

const bridge = new Bridge()

bridge.setSend(sendMessage)

onMessage((msg) => {
  if (msg && typeof msg === "object" && "id" in msg) {
    bridge.handleResponse(msg as { id: string; result?: unknown; error?: string })
  } else {
    log(`[host] unknown message: ${JSON.stringify(msg).slice(0, 200)}`)
  }
})

const { server, transport } = createMcpServer(bridge)

server.connect(transport).catch((err) => {
  always(`[host] MCP server connect error: ${err}`)
})

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 0, // disable timeout for SSE streams
  async fetch(req) {
    const url = new URL(req.url)
    log(`[host] HTTP ${req.method} ${url.pathname}`)
    if (url.pathname.startsWith("/mcp")) {
      return transport.handleRequest(req)
    }
    return new Response("opencode-native-host", { status: 200 })
  },
})

always(`[host] MCP server on http://127.0.0.1:${PORT}/mcp`)

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
process.on("uncaughtException", (err) => {
  always(`[host] uncaught exception: ${err}`)
  shutdown()
})

process.stdin.on("end", () => {
  always("[host] stdin ended, shutting down")
  shutdown()
})
process.stdin.on("close", () => {
  always("[host] stdin closed, shutting down")
  shutdown()
})

function shutdown() {
  always("[host] shutdown")
  bridge.destroy()
  process.exit(0)
}
