const NATIVE_HOST = "com.opencode.app"

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

let nativePort: chrome.runtime.Port | null = null
let lastError = ""

function connectNative(): chrome.runtime.Port {
  if (nativePort) return nativePort
  nativePort = chrome.runtime.connectNative(NATIVE_HOST)
  nativePort.onMessage.addListener((msg) => {
    if (msg && typeof msg === "object" && "id" in msg && "tool" in msg) {
      handleBridgeMessage(msg as BridgeMessage)
    }
  })
  nativePort.onDisconnect.addListener(() => {
    lastError = chrome.runtime.lastError?.message ?? "Unknown disconnect"
    nativePort = null
    broadcast({ type: "disconnected", error: lastError })
  })
  broadcast({ type: "connected" })
  return nativePort
}

function sendToNative(msg: unknown) {
  const port = connectNative()
  port.postMessage(msg)
}

function broadcast(msg: unknown) {
  chrome.runtime.sendMessage(msg).catch(() => {})
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && typeof msg === "object" && "type" in msg && msg.type === "get_status") {
    if (nativePort) return { connected: true }
    return { connected: false, error: lastError }
  }
  if (msg && typeof msg === "object" && "id" in msg && "tool" in msg) {
    handleBridgeMessage(msg as BridgeMessage)
    return true
  }
})

function handleBridgeMessage(msg: BridgeMessage) {
  switch (msg.tool) {
    case "list_tabs":
      chrome.tabs.query({}, (tabs) => {
        const result = tabs.map((t) => ({
          id: t.id,
          url: t.url,
          title: t.title,
          active: t.active,
          windowId: t.windowId,
        }))
        sendToNative({ id: msg.id, result })
      })
      break

    case "take_screenshot": {
      const windowId = msg.args.tabId != null ? Number(msg.args.tabId) : undefined
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
      chrome.tabs.update(Number(msg.args.tabId), { url: String(msg.args.url) }, (tab) => {
        if (chrome.runtime.lastError) {
          sendToNative({ id: msg.id, error: chrome.runtime.lastError.message })
          return
        }
        sendToNative({ id: msg.id, result: { id: tab?.id, url: tab?.url, title: tab?.title } })
      })
      break

    case "read_page_html":
    case "execute_js":
      chrome.tabs.sendMessage(Number(msg.args.tabId), msg, (response: BridgeResponse | undefined) => {
        if (chrome.runtime.lastError) {
          sendToNative({ id: msg.id, error: chrome.runtime.lastError.message })
          return
        }
        sendToNative(response ?? { id: msg.id, error: "No response from content script" })
      })
      break

    default:
      sendToNative({ id: msg.id, error: `Unknown tool: ${msg.tool}` })
  }
}

function handleScreenshot(dataUrl: string, id: string) {
  if (chrome.runtime.lastError) {
    sendToNative({ id, error: chrome.runtime.lastError.message })
    return
  }
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "")
  sendToNative({ id, result: { format: "png", data: base64 } })
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("tab/tab.html") })
})
