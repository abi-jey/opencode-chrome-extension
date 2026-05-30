const input = document.getElementById("input") as HTMLTextAreaElement | null
const button = document.getElementById("send") as HTMLButtonElement | null
const output = document.getElementById("output") as HTMLPreElement | null

if (button) {
  button.addEventListener("click", () => {
    if (!input) return
    const text = input.value
    chrome.runtime.sendMessage({ text }, (response: unknown) => {
      if (output) output.textContent = JSON.stringify(response, null, 2)
    })
  })
}
