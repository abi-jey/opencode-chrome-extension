chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.tool === "read_page_html") {
    const html = document.documentElement.outerHTML
    sendResponse({ id: message.id, result: html })
    return
  }

  if (message.tool === "execute_js") {
    try {
      const fn = new Function(`return (${message.code})`)
      const result = fn()
      sendResponse({ id: message.id, result })
    } catch (err) {
      sendResponse({ id: message.id, error: String(err) })
    }
    return
  }

  sendResponse({ id: message.id, error: `Unknown tool: ${message.tool}` })
  return
})
