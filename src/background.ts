const NATIVE_HOST = "com.opencode.app"

let nativePort: chrome.runtime.Port | null = null

function connectNative(): chrome.runtime.Port {
  if (nativePort) return nativePort

  nativePort = chrome.runtime.connectNative(NATIVE_HOST)
  nativePort.onDisconnect.addListener(() => {
    console.error("Native host disconnected:", chrome.runtime.lastError?.message)
    nativePort = null
  })
  return nativePort
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("tab/tab.html") })
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const port = connectNative()
  port.postMessage(message)
  port.onMessage.addListener(function handler(response: unknown) {
    sendResponse(response)
    port.onMessage.removeListener(handler)
  })
  return true
})
