const dot = document.getElementById("dot")!
const status = document.getElementById("status")!
const diag = document.getElementById("diag")!
const tabs = document.getElementById("tabs")!
const logEl = document.getElementById("log")!
const clearBtn = document.getElementById("clear")!
const forceBtn = document.getElementById("forceBtn")!

let logCount = 0
const MAX = 300

clearBtn.addEventListener("click", () => { logEl.innerHTML = ""; logCount = 0 })

forceBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "force_reconnect" }, (resp) => {
    append("info", "ui", `Force reconnect: ${resp?.ok ? "sent" : "SW did not respond"}`)
  })
  setTimeout(checkStatus, 2000)
})

fetch(chrome.runtime.getURL("build-info.json"))
  .then((r) => r.json())
  .then((info) => {
    const v = document.getElementById("vers")
    if (v) v.textContent = `v${info.version} (${info.commit})`
    const ver = document.getElementById("version")
    if (ver) ver.textContent = `v${info.version} · ${info.commit} · ${info.built.slice(0, 10)}`
    updateDiag("version", `${info.version} (${info.commit})`)
  })
  .catch(() => { updateDiag("version", `<span class=err>unknown</span>`) })

checkStatus()

// Timeout: if SW doesn't respond in 2s, show error
setTimeout(() => {
  if (dot.className === "dot") {
    dot.className = "dot error"
    status.textContent = "SW not responding"
    append("error", "ui", "Background service worker did not respond within 2s. Check chrome://extensions for errors.")
  }
}, 2000)

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return
  if (msg.type === "connected") { dot.className = "dot connected"; status.textContent = "Connected"; append("info", "sw", "Connected to native host") }
  if (msg.type === "disconnected") {
    dot.className = "dot error"
    status.textContent = "Disconnected"
    append("error", "sw", `Disconnected: ${msg.error ?? "?"}`)
  }
  if (msg.type === "log" || msg.type === "content_log") {
    append(msg.level ?? "info", msg.component ?? "", msg.message, msg.detail)
  }
})

function checkStatus() {
  chrome.runtime.sendMessage({ type: "get_status" }, (resp) => {
    if (chrome.runtime.lastError) {
      dot.className = "dot error"
      status.textContent = "SW unreachable"
      const err = chrome.runtime.lastError.message ?? ""
      updateDiag("sw", `<span class=err>${err}</span>`)
      append("error", "ui", `SW unreachable: ${err}`)
      return
    }
    updateDiag("sw", `<span class=ok>reachable</span>`)
    if (resp?.connected) {
      dot.className = "dot connected"
      status.textContent = "Connected"
    } else {
      dot.className = "dot"
      status.textContent = "Disconnected"
      updateDiag("native", resp?.error ? `<span class=err>${resp.error}</span>` : `<span class=warn>not connected</span>`)
    }
  })
  loadTabs()
}

function updateDiag(key: string, value: string) {
  const existing = diag.querySelector(`[data-key="${key}"]`)
  if (existing) { existing.innerHTML = `  <strong>${key}:</strong> ${value}`; return }
  const div = document.createElement("div")
  div.setAttribute("data-key", key)
  div.innerHTML = `<strong>${key}:</strong> ${value}`
  diag.appendChild(div)
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
    updateDiag("tabs", `${list.length} open`)
    tabs.innerHTML = list.map((t) => `
      <div class="tab-row">
        <span class="id">${t.id}</span>
        <span class="title">${esc(t.title || "Untitled")}</span>
        ${t.active ? '<span class="active-badge">active</span>' : ""}
      </div>
    `).join("")
  })
}

function esc(s: string) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML }

export {}
