chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.tool === "read_page_html") {
    chrome.runtime.sendMessage({
      type: "content_log",
      level: "debug",
      component: "content",
      message: `read_page_html requested, current URL: ${location.href}`,
      time: Date.now(),
    })
    const html = document.documentElement.outerHTML
    chrome.runtime.sendMessage({
      type: "content_log",
      level: "debug",
      component: "content",
      message: `read_page_html done, ${html.length} chars`,
      time: Date.now(),
    })
    sendResponse({ id: message.id, result: html })
    return
  }

  if (message.tool === "execute_js") {
    const code = String(message.code).slice(0, 200)
    chrome.runtime.sendMessage({
      type: "content_log",
      level: "info",
      component: "content",
      message: `execute_js: ${code}`,
      time: Date.now(),
    })
    try {
      const fn = new Function(`return (${message.code})`)
      const result = fn()
      chrome.runtime.sendMessage({
        type: "content_log",
        level: "debug",
        component: "content",
        message: `execute_js done, result type: ${typeof result}`,
        time: Date.now(),
      })
      sendResponse({ id: message.id, result })
    } catch (err) {
      chrome.runtime.sendMessage({
        type: "content_log",
        level: "error",
        component: "content",
        message: `execute_js error: ${String(err)}`,
        time: Date.now(),
      })
      sendResponse({ id: message.id, error: String(err) })
    }
    return
  }

  chrome.runtime.sendMessage({
    type: "content_log",
    level: "warn",
    component: "content",
    message: `unknown tool: ${message.tool}`,
    time: Date.now(),
  })
  sendResponse({ id: message.id, error: `Unknown tool: ${message.tool}` })
})
