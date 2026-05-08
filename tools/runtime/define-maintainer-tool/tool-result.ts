import type { ToolErrorCode, ToolResult } from '@/tools/catalog/types'

export type ToolFailure = Extract<ToolResult<never>, { ok: false }>

const toolErrorCodes = new Set<ToolErrorCode>([
  'invalid_input',
  'policy_denied',
  'provider_error',
  'rate_limited',
  'unavailable',
  'internal_error',
])

const httpStatusPattern = /HTTP \d{3}/

export function toolSuccess<TData>(data: TData): ToolResult<TData> {
  return { ok: true, data }
}

export function toolError(code: ToolErrorCode, message: string): ToolFailure {
  return { ok: false, code, message }
}

export function errorFromUnknown(err: unknown): ToolFailure {
  const code = codeFromUnknown(err)
  if (err instanceof Error) {
    return toolError(code, err.message)
  }
  return toolError(code, String(err))
}

export function auditErrorMessage(
  code: ToolErrorCode | null,
  message: string | null
): string | null {
  if (!(code && message)) {
    return null
  }
  if (code === 'provider_error') {
    return message.match(httpStatusPattern)?.[0] ?? 'Provider error'
  }
  return message
}

function codeFromUnknown(err: unknown): ToolErrorCode {
  if (typeof err !== 'object' || err === null || !('code' in err)) {
    return 'internal_error'
  }
  const code = (err as { code?: unknown }).code
  if (code === 'connection_unavailable') {
    return 'unavailable'
  }
  if (typeof code === 'string' && toolErrorCodes.has(code as ToolErrorCode)) {
    return code as ToolErrorCode
  }
  return 'internal_error'
}
