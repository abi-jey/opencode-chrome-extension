const dot = document.getElementById("dot")!
const status = document.getElementById("status")!
const tabs = document.getElementById("tabs")!
const logEl = document.getElementById("log")!
const clearBtn = document.getElementById("clear")!

let logCount = 0
const MAX = 300

clearBtn.addEventListener("click", () => {
  logEl.innerHTML = ""
  logCount = 0
})

chrome.runtime.sendMessage({ type: "get_status" }, (resp) => {
  if (chrome.runtime.lastError) {
    setStatus(false, chrome.runtime.lastError.message)
    return
  }
  resp?.connected ? setStatus(true) : setStatus(false, resp?.error)
})

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return
  if (msg.type === "connected") { setStatus(true); append("info", "sw", "Connected to native host") }
  if (msg.type === "disconnected") { setStatus(false, msg.error); append("error", "sw", `Disconnected: ${msg.error ?? "?"}`) }
  if (msg.type === "log" || msg.type === "content_log") {
    append(msg.level ?? "info", msg.component ?? "", msg.message, msg.detail)
  }
})

loadTabs()

function setStatus(connected: boolean, err?: string) {
  dot.className = connected ? "dot connected" : err ? "dot error" : "dot"
  status.textContent = connected ? "Connected" : err ? `Error: ${err}` : "Disconnected"
}

function append(level: string, component: string, msg: string, detail?: string) {
  const e = document.createElement("div")
  e.className = `log-entry ${level}`
  e.innerHTML = `<span class="ts">${new Date().toLocaleTimeString()}</span>[${level}] [${component}] ${msg}${detail ? " | " + detail : ""}`
  logEl.appendChild(e)
  while (logEl.children.length > MAX) logEl.firstChild?.remove()
  logCount++
  logEl.scrollTop = logEl.scrollHeight
}

function loadTabs() {
  chrome.tabs.query({}, (list) => {
    if (chrome.runtime.lastError || !list.length) {
      tabs.innerHTML = "<div style='color:#8b949e'>No tabs</div>"
      return
    }
    tabs.innerHTML = list
      .map(
        (t) => `
      <div class="tab-row">
        <span class="id">${t.id}</span>
        <span class="title">${esc(t.title || "Untitled")}</span>
        ${t.active ? '<span class="active-badge">active</span>' : ""}
      </div>
    `,
      )
      .join("")
  })
}

function esc(s: string) {
  const d = document.createElement("div")
  d.textContent = s
  return d.innerHTML
}

export {}
