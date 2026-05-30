const HEADER_SIZE = 4
const VERBOSE = process.env.LOG_LEVEL === "debug"
const log = (msg: string) => { if (VERBOSE) console.error(msg) }

export function onMessage(cb: (msg: unknown) => void): void {
  let buffer = Buffer.alloc(0)
  let expecting = HEADER_SIZE
  let msgLength = 0

  process.stdin.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk])

    while (buffer.length >= expecting) {
      if (expecting === HEADER_SIZE) {
        msgLength = buffer.readUInt32LE(0)
        if (msgLength > 1024 * 1024) {
          console.error("[native-msg] oversize message:", msgLength, "bytes")
          buffer = buffer.subarray(4)
          expecting = HEADER_SIZE
          continue
        }
        expecting += msgLength
        continue
      }

      const msgBytes = buffer.subarray(HEADER_SIZE, HEADER_SIZE + msgLength)
      const raw = msgBytes.toString("utf-8")
      try {
        const message = JSON.parse(raw)
        log(`[native-msg] recv: ${JSON.stringify(message).slice(0, 200)}`)
        cb(message)
      } catch (err) {
        console.error("[native-msg] parse error:", err, "raw:", raw.slice(0, 100))
      }

      buffer = buffer.subarray(HEADER_SIZE + msgLength)
      expecting = HEADER_SIZE
      msgLength = 0
    }
  })

  process.stdin.on("end", () => console.error("[native-msg] stdin closed"))
  process.stdin.on("error", (err) => console.error("[native-msg] stdin error:", err))
}

export function sendMessage(msg: unknown): void {
  const json = JSON.stringify(msg)
  const encoded = Buffer.from(json, "utf-8")
  const length = Buffer.alloc(HEADER_SIZE)
  length.writeUInt32LE(encoded.length, 0)
  process.stdout.write(Buffer.concat([length, encoded]))
  log(`[native-msg] sent: ${json.slice(0, 200)}`)
}
