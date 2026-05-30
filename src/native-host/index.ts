import { Bridge } from "./bridge.js"
import { onMessage, sendMessage } from "./native-messaging.js"
import { handleMcpRequest } from "./mcp-server.js"

const PORT = 19877
const VERBOSE = process.env.LOG_LEVEL === "debug"

function log(msg: string) { if (VERBOSE) console.error(msg) }
function always(msg: string) { console.error(msg) }

always(`[host] starting pid=${process.pid}`)

const bridge = new Bridge()
bridge.setSend(sendMessage)

onMessage((msg) => {
  if (msg && typeof msg === "object" && "id" in msg) {
    bridge.handleResponse(msg as { id: string; result?: unknown; error?: string })
  } else {
    log(`[host] unknown msg: ${JSON.stringify(msg).slice(0, 200)}`)
  }
})

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 0,
  async fetch(req) {
    const url = new URL(req.url)
    log(`[host] ${req.method} ${url.pathname}`)
    if (url.pathname.startsWith("/mcp")) return handleMcpRequest(bridge, req)
    return new Response("ok", { status: 200 })
  },
})

always(`[host] listening on :${PORT}`)

process.on("SIGTERM", () => process.exit(0))
process.on("SIGINT", () => process.exit(0))
process.on("uncaughtException", (err: Error) => {
  always(`[host] fatal: ${err.message}`)
  process.exit(0)
})
process.stdin.on("end", () => { always("[host] stdin ended"); process.exit(0) })
process.stdin.on("close", () => { always("[host] stdin closed"); process.exit(0) })
