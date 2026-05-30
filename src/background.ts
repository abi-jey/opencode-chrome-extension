const NATIVE_HOST = "com.github.abijey.browser_companion"

interface BridgeMessage {
  id: string
  tool: string
  args: Record<string, unknown>
}

interface BridgeResponse {
  id: string
  result?: unknown
  error?: string
}

type LogEntry = {
  type: "log"
  level: "info" | "warn" | "error" | "debug" | "tool_in" | "tool_out"
  component: string
  message: string
  detail?: string
  time: number
}

let nativePort: chrome.runtime.Port | null = null
let lastError = ""
const logBuffer: LogEntry[] = []
const MAX_BUFFER = 100

function log(level: LogEntry["level"], component: string, message: string, detail?: unknown) {
  const entry: LogEntry = {
    type: "log",
    level,
    component,
    message,
    detail: detail != null ? String(detail).slice(0, 500) : undefined,
    time: Date.now(),
  }
  console.log(`[${level}] [${component}] ${message}`, detail ?? "")
  logBuffer.push(entry)
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift()
  broadcast(entry)
}

function broadcast(msg: unknown) {
  chrome.runtime.sendMessage(msg).catch(() => {})
}

function connectNative(): chrome.runtime.Port | null {
  if (nativePort) return nativePort
  log("info", "sw", `connecting to: ${NATIVE_HOST}`)
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST)
  } catch (err) {
    lastError = String(err)
    log("error", "sw", `connectNative threw: ${lastError}`)
    broadcast({ type: "disconnected", error: lastError })
    return null
  }
  if (chrome.runtime.lastError) {
    lastError = chrome.runtime.lastError.message ?? ""
    log("error", "sw", `connectNative error: ${lastError}`)
    nativePort = null
    broadcast({ type: "disconnected", error: lastError })
    return null
  }
  nativePort.onMessage.addListener((raw) => {
    if (raw && typeof raw === "object" && "id" in raw && "tool" in raw) {
      handleBridgeMessage(raw as BridgeMessage)
    }
  })
  nativePort.onDisconnect.addListener(() => {
    lastError = chrome.runtime.lastError?.message ?? "disconnected"
    log("error", "sw", `native disconnected: ${lastError}`)
    nativePort = null
    broadcast({ type: "disconnected", error: lastError })
    setTimeout(() => connectWithRetry(2000), 2000)
  })
  log("info", "sw", "connected to native host")
  broadcast({ type: "connected" })
  return nativePort
}

function sendToNative(msg: unknown) {
  log("debug", "sw", `sending: ${JSON.stringify(msg).slice(0, 200)}`)
  if (!nativePort) {
    log("error", "sw", "port null, reconnecting")
    lastError = ""
    const port = chrome.runtime.connectNative(NATIVE_HOST)
    if (chrome.runtime.lastError) {
      log("error", "sw", `reconnect failed: ${chrome.runtime.lastError.message}`)
      return
    }
    nativePort = port
    nativePort.onMessage.addListener((raw) => {
      if (raw && typeof raw === "object" && "id" in raw && "tool" in raw) {
        handleBridgeMessage(raw as BridgeMessage)
      }
    })
    nativePort.onDisconnect.addListener(() => {
      lastError = chrome.runtime.lastError?.message ?? "disconnected"
      log("error", "sw", `native disconnected: ${lastError}`)
      nativePort = null
      broadcast({ type: "disconnected", error: lastError })
    })
  }
  nativePort.postMessage(msg)
}

function handleBridgeMessage(msg: BridgeMessage) {
  log("tool_in", "sw", `${msg.tool} id=${msg.id}`)
  switch (msg.tool) {
    case "list_tabs":
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) {
          sendToNative({ id: msg.id, error: chrome.runtime.lastError.message ?? "" })
          return
        }
        const result = tabs.map((t) => ({ id: t.id, url: t.url, title: t.title, active: t.active, windowId: t.windowId }))
        log("tool_out", "sw", `list_tabs count=${result.length}`)
        sendToNative({ id: msg.id, result })
      })
      break
    case "take_screenshot": {
      const windowId = msg.args.tabId != null ? Number(msg.args.tabId) : undefined
      const cb = (dataUrl: string) => {
        if (chrome.runtime.lastError) { sendToNative({ id: msg.id, error: chrome.runtime.lastError.message ?? "" }); return }
        sendToNative({ id: msg.id, result: { format: "png", data: dataUrl.replace(/^data:image\/png;base64,/, "") } })
      }
      if (windowId != null) chrome.tabs.captureVisibleTab(windowId, { format: "png" }, cb)
      else chrome.tabs.captureVisibleTab({ format: "png" }, cb)
      break
    }
    case "navigate":
      chrome.tabs.update(Number(msg.args.tabId), { url: String(msg.args.url) }, (tab) => {
        if (chrome.runtime.lastError) { sendToNative({ id: msg.id, error: chrome.runtime.lastError.message ?? "" }); return }
        sendToNative({ id: msg.id, result: { id: tab?.id, url: tab?.url, title: tab?.title } })
      })
      break
    case "read_page_html":
    case "execute_js":
      chrome.tabs.sendMessage(Number(msg.args.tabId), msg, (response: BridgeResponse | undefined) => {
        if (chrome.runtime.lastError) { sendToNative({ id: msg.id, error: chrome.runtime.lastError.message ?? "" }); return }
        sendToNative(response ?? { id: msg.id, error: "No response from content script" })
      })
      break
    default:
      sendToNative({ id: msg.id, error: `Unknown tool: ${msg.tool}` })
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return
  if (msg.type === "get_status") {
    sendResponse(nativePort ? { connected: true } : { connected: false, error: lastError })
    return true
  }
  if (msg.type === "get_logs") {
    sendResponse({ logs: logBuffer.slice() })
    return true
  }
  if (msg.type === "force_reconnect") {
    lastError = ""
    if (nativePort) { nativePort.disconnect(); nativePort = null }
    const port = connectNative()
    sendResponse({ ok: port != null })
    return true
  }
})

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && typeof msg === "object" && msg.type === "content_log") {
    broadcast(msg as LogEntry)
  }
})

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("tab/tab.html") })
})

log("info", "sw", `ready v0.2.0, host=${NATIVE_HOST}`)

// Auto-connect and keep alive
connectWithRetry()

function connectWithRetry(delay = 1000) {
  const maxDelay = 30000
  const port = connectNative()
  if (!port) {
    log("warn", "sw", `connect failed, retry in ${delay}ms`)
    setTimeout(() => connectWithRetry(Math.min(delay * 2, maxDelay)), delay)
  }
}
