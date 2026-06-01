import type { ToolErrorCode } from '@outname/ai/tools/catalog/types'
import type { BrokeredHttpResponse } from '../brokered-http/types'
import { type ToolFailure, toolError } from './tool-result'

const DEFAULT_PROVIDER_ERROR_BODY_LIMIT = 1000

type ProviderResponseLike = Pick<
  BrokeredHttpResponse,
  'bodyText' | 'status' | 'truncated'
>

interface ProviderErrorOptions {
  bodyLimit?: number
  label: string
}

export function clipProviderErrorMessage(
  error: unknown,
  options: ProviderErrorOptions
): string {
  const rawMessage = error instanceof Error ? error.message : String(error)
  const normalizedMessage = rawMessage.replace(/\s+/g, ' ').trim()
  const clippedMessage = clipText(
    normalizedMessage,
    options.bodyLimit ?? DEFAULT_PROVIDER_ERROR_BODY_LIMIT
  )
  return clippedMessage
    ? `${options.label} failed: ${clippedMessage}`
    : `${options.label} failed.`
}

function parseProviderResponseBody(
  raw: string,
  contentType: string | undefined
): unknown {
  if (raw.length === 0) {
    return null
  }
  if (contentType?.includes('application/json')) {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      return raw
    }
  }
  return raw
}

export function parseProviderResponseFromHttp(
  response: Pick<BrokeredHttpResponse, 'bodyText' | 'headers'>
): unknown {
  return parseProviderResponseBody(
    response.bodyText,
    response.headers['content-type']
  )
}

export function toolErrorFromProviderResponse(
  response: ProviderResponseLike,
  options: ProviderErrorOptions & {
    errorCode?: ToolErrorCode
    errorCodeForStatus?: (status: number) => ToolErrorCode
  }
): ToolFailure {
  const errorCode =
    options.errorCodeForStatus?.(response.status) ??
    options.errorCode ??
    'provider_error'
  return toolError(errorCode, clippedProviderError(response, options))
}

function clippedProviderError(
  response: ProviderResponseLike,
  options: ProviderErrorOptions
): string {
  const body = response.bodyText.trim()
  if (!body) {
    return `${options.label} failed (HTTP ${response.status}).`
  }
  const bodyLimit = options.bodyLimit ?? DEFAULT_PROVIDER_ERROR_BODY_LIMIT
  const truncated = response.truncated || body.length > bodyLimit
  const suffix = truncated ? ' [truncated]' : ''
  return `${options.label} failed (HTTP ${response.status}): ${clipText(body, bodyLimit)}${suffix}`
}

function clipText(text: string, bodyLimit: number): string {
  return text.slice(0, bodyLimit)
}
