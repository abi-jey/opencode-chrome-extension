const dot = document.getElementById("statusDot")!
const text = document.getElementById("statusText")!
const tabList = document.getElementById("tabList")!
const refreshBtn = document.getElementById("refreshBtn")!

const logEl = document.createElement("div")
logEl.id = "log"
logEl.style.cssText = "margin-top:12px; font-size:11px; color:#888; max-height:160px; overflow-y:auto"
document.body.appendChild(logEl)

refreshBtn.addEventListener("click", loadTabs)

// Request status from background SW
chrome.runtime.sendMessage({ type: "get_status" }, (status) => {
  if (chrome.runtime.lastError) {
    setStatus(false, chrome.runtime.lastError.message)
    return
  }
  if (status?.connected) setStatus(true)
  else setStatus(false, status?.error)
})

// Listen for broadcast status updates from background SW
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "connected") setStatus(true)
  if (msg.type === "disconnected") setStatus(false, msg.error)
})

loadTabs()

function setStatus(connected: boolean, error?: string) {
  dot.className = connected ? "dot connected" : "dot"
  text.textContent = connected ? "Connected" : "Disconnected"
  if (error) addLog(`[error] ${error}`)
}

function addLog(msg: string) {
  const line = document.createElement("div")
  line.textContent = new Date().toLocaleTimeString() + " " + msg
  logEl.appendChild(line)
  logEl.scrollTop = logEl.scrollHeight
}

function loadTabs() {
  chrome.tabs.query({}, (tabs) => {
    if (chrome.runtime.lastError) {
      tabList.innerHTML = `<div style="color:#c62828">Error: ${esc(chrome.runtime.lastError.message ?? "")}</div>`
      return
    }
    if (tabs.length === 0) {
      tabList.innerHTML = "<div style='color:#888'>No tabs</div>"
      return
    }
    tabList.innerHTML = tabs
      .map(
        (t) => `
      <div class="tab-item">
        <div>
          <div class="title">${esc(t.title || "Untitled")}</div>
          <div class="url">${esc(t.url || "")}</div>
        </div>
        <div class="toggle ${t.active ? "on" : ""}"></div>
      </div>
    `,
      )
      .join("")
  })
}

function esc(s: string): string {
  const div = document.createElement("div")
  div.textContent = s
  return div.innerHTML
}
