import type { getConnector } from '@outname/shared/connections/registry'
import { DEFAULT_MAX_RESPONSE_BYTES, MAX_RESPONSE_BYTES } from './constants'
import { BrokeredHttpError } from './types'

const FORBIDDEN_REQUEST_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'apikey',
  'x-auth-token',
  'cookie',
  'set-cookie',
])

export type BrokerRequestAuthMode = 'authenticated' | 'unauthenticated'

export interface BrokerValidatedUrl {
  mode: BrokerRequestAuthMode
  url: URL
}

export function normalizeHeaders(
  headers: Record<string, string> | undefined,
  injectedHeaderNames: readonly string[]
): Record<string, string> {
  const normalized: Record<string, string> = {}
  const brokerManagedHeaders = new Set([
    ...FORBIDDEN_REQUEST_HEADERS,
    ...injectedHeaderNames.map((header) => header.toLowerCase()),
  ])
  for (const [key, value] of Object.entries(headers ?? {})) {
    const lower = key.toLowerCase()
    if (brokerManagedHeaders.has(lower)) {
      throw new BrokeredHttpError(`Header "${key}" is managed by the broker.`)
    }
    normalized[lower] = value
  }
  return normalized
}

export function validateUrl(
  provider: string,
  method: string,
  rawUrl: string,
  connector: NonNullable<ReturnType<typeof getConnector>>
): BrokerValidatedUrl {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new BrokeredHttpError(`${provider}: request URL is invalid.`)
  }
  if (url.protocol !== 'https:') {
    throw new BrokeredHttpError(
      `${provider}: brokered requests must use HTTPS.`
    )
  }
  if (url.username !== '' || url.password !== '') {
    throw new BrokeredHttpError(
      `${provider}: request URL must not include credentials.`
    )
  }
  if (connector.broker.allowedHosts.includes(url.hostname)) {
    return { mode: 'authenticated', url }
  }
  if (connector.broker.allowUnauthenticatedRequest?.({ method, url })) {
    return { mode: 'unauthenticated', url }
  }
  throw new BrokeredHttpError(
    `${provider}: host "${url.hostname}" is not allowed for this connector.`
  )
}

export function responseLimit(
  connectorLimit: number | undefined,
  requestLimit: number | undefined
): number {
  const raw = requestLimit ?? connectorLimit ?? DEFAULT_MAX_RESPONSE_BYTES
  return Math.max(1, Math.min(raw, MAX_RESPONSE_BYTES))
}

export function bodyTextFor(body: unknown): string | undefined {
  if (body === undefined) {
    return
  }
  return typeof body === 'string' ? body : JSON.stringify(body)
}

export function validateInjectedHeaders(
  provider: string,
  declaredHeaderNames: readonly string[],
  injectedHeaders: Record<string, string>
): Record<string, string> {
  const declared = new Set(
    declaredHeaderNames.map((header) => header.toLowerCase())
  )
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(injectedHeaders)) {
    const lower = key.toLowerCase()
    if (!declared.has(lower)) {
      throw new BrokeredHttpError(
        `${provider}: connector injected undeclared header "${key}".`
      )
    }
    normalized[lower] = value
  }
  for (const key of declared) {
    if (!(key in normalized)) {
      throw new BrokeredHttpError(
        `${provider}: connector did not provide declared header "${key}".`
      )
    }
  }
  return normalized
}
