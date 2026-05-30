const NATIVE_HOST = "com.github.abijey.browser-companion"

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

function log(level: LogEntry["level"], component: string, message: string, detail?: unknown) {
  const entry: LogEntry = {
    type: "log",
    level,
    component,
    message,
    detail: detail != null ? String(detail).slice(0, 500) : undefined,
    time: Date.now(),
  }
  broadcast(entry)
}

function broadcast(msg: unknown) {
  chrome.runtime.sendMessage(msg).catch(() => {})
}

function connectNative(): chrome.runtime.Port {
  if (nativePort) {
    log("debug", "sw", "native port already connected")
    return nativePort
  }
  log("info", "sw", `connecting to native host: ${NATIVE_HOST}`)
  nativePort = chrome.runtime.connectNative(NATIVE_HOST)
  nativePort.onMessage.addListener((msg) => {
    log("debug", "sw", `msg from native: ${JSON.stringify(msg).slice(0, 200)}`)
    if (msg && typeof msg === "object" && "id" in msg && "tool" in msg) {
      handleBridgeMessage(msg as BridgeMessage)
    }
  })
  nativePort.onDisconnect.addListener(() => {
    lastError = chrome.runtime.lastError?.message ?? "Unknown disconnect"
    log("error", "sw", `native host disconnected: ${lastError}`)
    nativePort = null
    broadcast({ type: "disconnected", error: lastError })
  })
  log("debug", "sw", "native port created")
  broadcast({ type: "connected" })
  return nativePort
}

function sendToNative(msg: unknown) {
  const preview = JSON.stringify(msg).slice(0, 200)
  log("debug", "sw", `sending to native: ${preview}`)
  const port = connectNative()
  port.postMessage(msg)
}

// Incoming message from the native host (via sendToNative -> postMessage doesn't work backwards;
// the native host sends to us via nativePort.onMessage which calls handleBridgeMessage)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Request from sidebar/tab for status
  if (msg && typeof msg === "object" && "type" in msg && msg.type === "get_status") {
    if (nativePort) return { connected: true }
    return { connected: false, error: lastError }
  }

  // Outgoing message from sidebar/tab that should be forwarded to native host
  // (e.g., the tab page sends a message that triggers native messaging)
  if (sender.tab && msg && typeof msg === "object" && "test" in msg) {
    const port = connectNative()
    log("info", "sw", `forwarding message from tab to native: ${JSON.stringify(msg)}`)
    port.postMessage(msg)
    port.onMessage.addListener(function handler(response: unknown) {
      log("debug", "sw", `response from native: ${JSON.stringify(response).slice(0, 200)}`)
      sendResponse(response)
      port.onMessage.removeListener(handler)
    })
    return true
  }
})

function handleBridgeMessage(msg: BridgeMessage) {
  log("tool_in", "sw", `tool=${msg.tool} id=${msg.id}`, JSON.stringify(msg.args).slice(0, 200))
  switch (msg.tool) {
    case "list_tabs":
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) {
          const err = chrome.runtime.lastError.message ?? ""
          log("error", "sw", `list_tabs query failed: ${err}`)
          sendToNative({ id: msg.id, error: err })
          return
        }
        const result = tabs.map((t) => ({
          id: t.id,
          url: t.url,
          title: t.title,
          active: t.active,
          windowId: t.windowId,
        }))
        log("tool_out", "sw", `list_tabs id=${msg.id} count=${result.length}`)
        sendToNative({ id: msg.id, result })
      })
      break

    case "take_screenshot": {
      const windowId = msg.args.tabId != null ? Number(msg.args.tabId) : undefined
      log("info", "sw", `take_screenshot windowId=${windowId ?? "current"}`)
      if (windowId != null) {
        chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) =>
          handleScreenshot(dataUrl, msg.id),
        )
      } else {
        chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) =>
          handleScreenshot(dataUrl, msg.id),
        )
      }
      break
    }

    case "navigate":
      log("info", "sw", `navigate tabId=${msg.args.tabId} url=${msg.args.url}`)
      chrome.tabs.update(Number(msg.args.tabId), { url: String(msg.args.url) }, (tab) => {
        if (chrome.runtime.lastError) {
          const err = chrome.runtime.lastError.message ?? ""
          log("error", "sw", `navigate failed: ${err}`)
          sendToNative({ id: msg.id, error: err })
          return
        }
        const result = { id: tab?.id, url: tab?.url, title: tab?.title }
        log("tool_out", "sw", `navigate id=${msg.id}`, JSON.stringify(result))
        sendToNative({ id: msg.id, result })
      })
      break

    case "read_page_html":
    case "execute_js":
      log("info", "sw", `${msg.tool} tabId=${msg.args.tabId}`)
      chrome.tabs.sendMessage(Number(msg.args.tabId), msg, (response: BridgeResponse | undefined) => {
        if (chrome.runtime.lastError) {
          const err = chrome.runtime.lastError.message ?? ""
          log("error", "sw", `${msg.tool} sendMessage failed: ${err}`)
          sendToNative({ id: msg.id, error: err })
          return
        }
        if (response?.error) {
          log("warn", "sw", `${msg.tool} content script error: ${response.error}`)
        } else if (msg.tool === "read_page_html" && typeof response?.result === "string") {
          log("tool_out", "sw", `read_page_html id=${msg.id} size=${response.result.length} chars`)
        } else {
          log("tool_out", "sw", `${msg.tool} id=${msg.id}`, JSON.stringify(response).slice(0, 200))
        }
        sendToNative(response ?? { id: msg.id, error: "No response from content script" })
      })
      break

    default:
      log("warn", "sw", `unknown tool: ${msg.tool}`)
      sendToNative({ id: msg.id, error: `Unknown tool: ${msg.tool}` })
  }
}

function handleScreenshot(dataUrl: string, id: string) {
  if (chrome.runtime.lastError) {
    const err = chrome.runtime.lastError.message ?? ""
    log("error", "sw", `screenshot failed: ${err}`)
    sendToNative({ id, error: err })
    return
  }
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "")
  log("tool_out", "sw", `screenshot id=${id} size=${base64.length} chars`)
  sendToNative({ id, result: { format: "png", data: base64 } })
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && typeof msg === "object" && "type" in msg && msg.type === "content_log") {
    const entry = msg as LogEntry
    broadcast(entry)
  }
})

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("tab/tab.html") })
})

// Auto-connect to native host on startup (triggers Chrome to launch the native host binary)
connectNative()
