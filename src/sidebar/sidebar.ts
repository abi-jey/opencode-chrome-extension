const dot = document.getElementById("statusDot")!
const text = document.getElementById("statusText")!
const tabList = document.getElementById("tabList")!
const refreshBtn = document.getElementById("refreshBtn")!

refreshBtn.addEventListener("click", loadTabs)
loadTabs()

function loadTabs() {
  chrome.tabs.query({}, (tabs) => {
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

// Check native host connection
const port = chrome.runtime.connectNative("com.opencode.app")
port.onDisconnect.addListener(() => {
  dot.className = "dot"
  text.textContent = "Disconnected"
})
// If we get here without immediate disconnect, we're connected
setTimeout(() => {
  dot.className = "dot connected"
  text.textContent = "Connected"
}, 500)

function esc(s: string): string {
  const div = document.createElement("div")
  div.textContent = s
  return div.innerHTML
}
