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
    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
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
    if (!req) return
    this.pending.delete(msg.id)
    clearTimeout(req.timer)
    if (msg.error) req.reject(new Error(msg.error))
    else req.resolve(msg.result)
  }

  destroy() {
    for (const [id, req] of this.pending) {
      clearTimeout(req.timer)
      req.reject(new Error("Bridge destroyed"))
      this.pending.delete(id)
    }
  }
}
