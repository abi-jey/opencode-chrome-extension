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
  if (nativePort) {
    log("debug", "sw", "already connected, skipping")
    return nativePort
  }
  log("info", "sw", `connecting to: ${NATIVE_HOST}`)
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST)
  } catch (err) {
    const msg = String(err)
    lastError = msg
    log("error", "sw", `connectNative threw: ${msg}`)
    broadcast({ type: "disconnected", error: msg })
    return null
  }
  if (chrome.runtime.lastError) {
    lastError = chrome.runtime.lastError.message ?? ""
    log("error", "sw", `connectNative error: ${lastError}`)
    nativePort = null
    broadcast({ type: "disconnected", error: lastError })
    return null
  }
  nativePort.onMessage.addListener((msg) => {
    log("debug", "sw", `msg from native: ${JSON.stringify(msg).slice(0, 200)}`)
    if (msg && typeof msg === "object" && "id" in msg && "tool" in msg) {
      handleBridgeMessage(msg as BridgeMessage)
    }
  })
  nativePort.onDisconnect.addListener(() => {
    lastError = chrome.runtime.lastError?.message ?? "Unknown disconnect"
    log("error", "sw", `native disconnected: ${lastError}`)
    nativePort = null
    broadcast({ type: "disconnected", error: lastError })
  })
  log("info", "sw", "connected to native host")
  broadcast({ type: "connected" })
  return nativePort
}

function sendToNative(msg: unknown) {
  const preview = JSON.stringify(msg).slice(0, 200)
  log("debug", "sw", `sending to native: ${preview}`)
  const port = connectNative()
  if (!port) {
    log("error", "sw", "cannot send, native port is null")
    return
  }
  port.postMessage(msg)
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && typeof msg === "object") {
    if (msg.type === "get_status") {
      if (nativePort) return { connected: true }
      return { connected: false, error: lastError }
    }
    if (msg.type === "get_logs") {
      return { logs: logBuffer.slice() }
    }
    if (msg.type === "force_reconnect") {
      lastError = ""
      nativePort = null
      const port = connectNative()
      return { ok: port != null }
    }
  }
  if (sender.tab && msg && typeof msg === "object" && "test" in msg) {
    const port = connectNative()
    if (!port) {
      sendResponse({ error: "Native host not connected" })
      return true
    }
    port.postMessage(msg)
    port.onMessage.addListener(function handler(response: unknown) {
      sendResponse(response)
      port.onMessage.removeListener(handler)
    })
    return true
  }
})

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && typeof msg === "object" && msg.type === "content_log") {
    broadcast(msg as LogEntry)
  }
})

function handleBridgeMessage(msg: BridgeMessage) {
  log("tool_in", "sw", `tool=${msg.tool} id=${msg.id}`)
  switch (msg.tool) {
    case "list_tabs":
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) {
          const err = chrome.runtime.lastError.message ?? ""
          log("error", "sw", `list_tabs failed: ${err}`)
          sendToNative({ id: msg.id, error: err })
          return
        }
        const result = tabs.map((t) => ({ id: t.id, url: t.url, title: t.title, active: t.active, windowId: t.windowId }))
        log("tool_out", "sw", `list_tabs count=${result.length}`)
        sendToNative({ id: msg.id, result })
      })
      break

    case "take_screenshot": {
      const windowId = msg.args.tabId != null ? Number(msg.args.tabId) : undefined
      log("info", "sw", `screenshot windowId=${windowId ?? "current"}`)
      const cb = (dataUrl: string) => {
        if (chrome.runtime.lastError) {
          sendToNative({ id: msg.id, error: chrome.runtime.lastError.message ?? "" })
          return
        }
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "")
        log("tool_out", "sw", `screenshot size=${base64.length}`)
        sendToNative({ id: msg.id, result: { format: "png", data: base64 } })
      }
      if (windowId != null) chrome.tabs.captureVisibleTab(windowId, { format: "png" }, cb)
      else chrome.tabs.captureVisibleTab({ format: "png" }, cb)
      break
    }

    case "navigate":
      log("info", "sw", `navigate tabId=${msg.args.tabId} url=${msg.args.url}`)
      chrome.tabs.update(Number(msg.args.tabId), { url: String(msg.args.url) }, (tab) => {
        if (chrome.runtime.lastError) {
          sendToNative({ id: msg.id, error: chrome.runtime.lastError.message ?? "" })
          return
        }
        sendToNative({ id: msg.id, result: { id: tab?.id, url: tab?.url, title: tab?.title } })
      })
      break

    case "read_page_html":
    case "execute_js":
      log("info", "sw", `${msg.tool} tabId=${msg.args.tabId}`)
      chrome.tabs.sendMessage(Number(msg.args.tabId), msg, (response: BridgeResponse | undefined) => {
        if (chrome.runtime.lastError) {
          sendToNative({ id: msg.id, error: chrome.runtime.lastError.message ?? "" })
          return
        }
        sendToNative(response ?? { id: msg.id, error: "No response from content script" })
      })
      break

    default:
      log("warn", "sw", `unknown tool: ${msg.tool}`)
      sendToNative({ id: msg.id, error: `Unknown tool: ${msg.tool}` })
  }
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("tab/tab.html") })
})

// Don't auto-connect on startup — let the debug page trigger it
log("info", "sw", "service worker ready, waiting for connect signal")

export {}
