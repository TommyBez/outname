import type { z } from 'zod'

// Opaque connector-owned credential payload. It stays encrypted at rest and is
// only decrypted inside the broker/runtime layer, never inside the tool VM.
export type RawCredential = unknown

export type ConnectorCredential<TConnector> =
  TConnector extends ApiKeyConnector<infer TCredential, string>
    ? TCredential
    : never

export interface ApiKeyFieldDescriptor {
  description?: string
  label: string
  name: string
  placeholder?: string
  type: 'text' | 'password'
}

export interface ApiKeyValidateResult {
  error?: string
  metadata?: Record<string, unknown>
  ok: boolean
}

export interface ConnectorBroker<TCredential> {
  // Keep the allowed host list explicit; wildcard transforms weaken exfiltration auditing.
  allowedHosts: readonly string[]
  // Optional escape hatch for provider-issued presigned URLs.
  allowUnauthenticatedRequest?(request: { method: string; url: URL }): boolean
  // Tool code may not set broker-owned auth headers itself.
  injectedHeaderNames: readonly string[]
  // Convert decrypted credentials into headers injected outside the VM.
  injectedHeaders(credential: TCredential): Record<string, string>
  maxResponseBytes?: number
}

export interface ApiKeyConnector<
  TCredential = Record<string, unknown>,
  TProvider extends string = string,
> {
  apiKey: {
    // Only fields strictly required to authenticate belong here; per-tool
    // defaults stay in `tool.configSchema`.
    formSchema: z.ZodType<TCredential>
    fields: ApiKeyFieldDescriptor[]
    // Optional cheap probe to fail bad keys during form submit.
    validate?(values: Record<string, string>): Promise<ApiKeyValidateResult>
  }
  broker: ConnectorBroker<TCredential>
  description: string
  displayName: string
  kind: 'api_key'
  provider: TProvider
}

export type Connector = ApiKeyConnector<unknown, string>

// `Reconnect` stays in `tools/types.ts` so connectors and tool UI share one
// canonical shape without creating a circular dependency.
