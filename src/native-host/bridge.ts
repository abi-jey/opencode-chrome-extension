const VERBOSE = process.env.LOG_LEVEL === "debug"
const log = (msg: string) => { if (VERBOSE) console.error(msg) }
const always = (msg: string) => console.error(msg)

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const TIMEOUT = 30_000

export class Bridge {
  private pending = new Map<string, PendingRequest>()
  private onSend: ((msg: object) => void) | null = null
  private requestId = 0

  setSend(cb: (msg: object) => void) {
    this.onSend = cb
  }

  call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const id = String(++this.requestId)
    log(`[bridge] call ${tool} id=${id} args=${JSON.stringify(args).slice(0, 100)}`)
    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        always(`[bridge] timeout ${tool} id=${id}`)
        reject(new Error(`Request ${tool} timed out after ${TIMEOUT}ms`))
      }, TIMEOUT)
      this.pending.set(id, { resolve, reject, timer })
    })
    if (!this.onSend) throw new Error("Bridge not connected to native messaging")
    this.onSend({ id, tool, args })
    return promise
  }

  handleResponse(msg: { id: string; result?: unknown; error?: string }) {
    const req = this.pending.get(msg.id)
    if (!req) {
      log(`[bridge] no pending request for id=${msg.id}`)
      return
    }
    this.pending.delete(msg.id)
    clearTimeout(req.timer)
    if (msg.error) {
      always(`[bridge] response id=${msg.id} error=${msg.error}`)
      req.reject(new Error(msg.error))
    } else {
      const preview = typeof msg.result === "string" ? msg.result.slice(0, 80) : JSON.stringify(msg.result).slice(0, 80)
      log(`[bridge] response id=${msg.id} result=${preview}`)
      req.resolve(msg.result)
    }
  }

  destroy() {
    log(`[bridge] destroying ${this.pending.size} pending requests`)
    for (const [id, req] of this.pending) {
      clearTimeout(req.timer)
      req.reject(new Error("Bridge destroyed"))
      this.pending.delete(id)
    }
  }
}
