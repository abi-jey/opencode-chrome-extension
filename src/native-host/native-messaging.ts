const HEADER_SIZE = 4

export function onMessage(cb: (msg: unknown) => void): void {
  let buffer = Buffer.alloc(0)
  let expecting = HEADER_SIZE
  let msgLength = 0

  process.stdin.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk])

    while (buffer.length >= expecting) {
      if (expecting === HEADER_SIZE) {
        msgLength = buffer.readUInt32LE(0)
        expecting += msgLength
        continue
      }

      const msgBytes = buffer.subarray(HEADER_SIZE, HEADER_SIZE + msgLength)
      const message = msgBytes.toString("utf-8")
      try {
        cb(JSON.parse(message))
      } catch (err) {
        console.error("Failed to parse native message:", err)
      }

      buffer = buffer.subarray(HEADER_SIZE + msgLength)
      expecting = HEADER_SIZE
      msgLength = 0
    }
  })
}

export function sendMessage(msg: unknown): void {
  const json = JSON.stringify(msg)
  const encoded = Buffer.from(json, "utf-8")
  const length = Buffer.alloc(HEADER_SIZE)
  length.writeUInt32LE(encoded.length, 0)
  process.stdout.write(Buffer.concat([length, encoded]))
}
