const dot = document.getElementById("statusDot")!
const text = document.getElementById("statusText")!
const tabList = document.getElementById("tabList")!
const tabCount = document.getElementById("tabCount")!
const refreshBtn = document.getElementById("refreshBtn")!
const logEl = document.getElementById("log")!
const logCount = document.getElementById("logCount")!
const clearLog = document.getElementById("clearLog")!

const MAX_LOG = 200
let logs = 0

refreshBtn.addEventListener("click", loadTabs)
clearLog.addEventListener("click", () => {
  logEl.innerHTML = ""
  logs = 0
  logCount.textContent = "0"
})

// Request initial status
chrome.runtime.sendMessage({ type: "get_status" }, (status) => {
  if (chrome.runtime.lastError) {
    setStatus(false, chrome.runtime.lastError.message)
    return
  }
  if (status?.connected) setStatus(true)
  else setStatus(false, status?.error)
})

// Listen for log broadcasts and status updates
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return

  if (msg.type === "connected") {
    setStatus(true)
    appendLog("info", "sw", "Connected to native host")
  }
  if (msg.type === "disconnected") {
    setStatus(false, msg.error)
    appendLog("error", "sw", `Disconnected: ${msg.error ?? "unknown"}`)
  }

  if (msg.type === "log") {
    appendLog(msg.level ?? "info", msg.component ?? "", msg.message, msg.detail)
  }

  if (msg.type === "content_log") {
    appendLog(msg.level ?? "debug", msg.component ?? "content", msg.message)
  }
})

loadTabs()

function setStatus(connected: boolean, error?: string) {
  if (connected) {
    dot.className = "dot connected"
    text.textContent = "Connected"
  } else if (error) {
    dot.className = "dot error"
    text.textContent = "Error"
  } else {
    dot.className = "dot"
    text.textContent = "Disconnected"
  }
}

function appendLog(level: string, component: string, message: string, detail?: string) {
  const entry = document.createElement("div")
  entry.className = `log-entry ${level}`
  const ts = new Date().toLocaleTimeString()
  const detailStr = detail ? ` | ${detail}` : ""
  entry.innerHTML = `<span class="ts">${ts}</span>[${level}] [${component}] ${message}${detailStr}`
  logEl.appendChild(entry)

  // Limit entries
  while (logEl.children.length > MAX_LOG) {
    logEl.firstChild?.remove()
  }
  logs = Math.min(logs + 1, MAX_LOG)
  logCount.textContent = String(logs)
  logEl.scrollTop = logEl.scrollHeight
}

function loadTabs() {
  chrome.tabs.query({}, (tabs) => {
    if (chrome.runtime.lastError) {
      tabList.innerHTML = `<div style="color:#f85149">Error loading tabs</div>`
      return
    }
    tabCount.textContent = String(tabs.length)
    if (tabs.length === 0) {
      tabList.innerHTML = "<div style='color:#8b949e'>No open tabs</div>"
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
