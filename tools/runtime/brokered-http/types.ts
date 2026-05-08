export interface BrokeredHttpRequest {
  body?: unknown
  headers?: Record<string, string>
  maxResponseBytes?: number
  method: string
  timeoutMs?: number
  url: string
}

export interface BrokeredHttpResponse {
  bodyText: string
  headers: Record<string, string>
  ok: boolean
  status: number
  truncated: boolean
}

export class BrokeredHttpError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BrokeredHttpError'
  }
}
