import type { z } from 'zod'

// Opaque connector-owned credential payload. It stays encrypted at rest and is
// only decrypted inside the broker/runtime layer, never inside the tool VM.
export type RawCredential = unknown

export type ConnectorCredential<TConnector> =
  TConnector extends BaseConnector<infer TCredential, string>
    ? TCredential
    : never

export type AuthKind = 'api_key' | 'oauth2'

export interface StoredApiKeyCredentialBlob {
  kind: 'api_key'
  values: unknown
}

export interface StoredOAuth2CredentialBlob {
  accessToken: string
  kind: 'oauth2'
  refreshToken?: string
  tokenType: 'Bearer'
  version: 1
}

export type StoredCredentialBlob =
  | StoredApiKeyCredentialBlob
  | StoredOAuth2CredentialBlob

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

export interface BaseConnector<TCredential, TConnectorId extends string> {
  authKind: AuthKind
  broker: ConnectorBroker<TCredential>
  connectorId: TConnectorId
  description: string
  displayName: string
  providerGroup: string
  surface: string
}

export interface ApiKeyConnector<
  TCredential = Record<string, unknown>,
  TConnectorId extends string = string,
> extends BaseConnector<TCredential, TConnectorId> {
  apiKey: {
    // Only fields strictly required to authenticate belong here; per-tool
    // defaults stay in `tool.configSchema`.
    formSchema: z.ZodType<TCredential>
    fields: ApiKeyFieldDescriptor[]
    // Optional cheap probe to fail bad keys during form submit.
    validate?(values: Record<string, string>): Promise<ApiKeyValidateResult>
  }
  authKind: 'api_key'
}

export interface ScopeDescriptor {
  description?: string
  label: string
  scope: string
}

export interface OAuth2TokenResponse {
  access_token?: unknown
  error?: unknown
  error_description?: unknown
  expires_in?: unknown
  refresh_token?: unknown
  scope?: unknown
  token_type?: unknown
}

export interface OAuth2Connector<TConnectorId extends string = string>
  extends BaseConnector<StoredOAuth2CredentialBlob, TConnectorId> {
  authKind: 'oauth2'
  oauth2: {
    authorizationUrl: string
    clientIdEnv: string
    clientSecretEnv?: string
    defaultScopes: readonly string[]
    pkce: { method: 'S256' }
    profile?(
      accessToken: string
    ): Promise<Record<string, unknown>> | Record<string, unknown>
    revokeUrl?: string
    scopeCatalog: readonly ScopeDescriptor[]
    tokenUrl: string
  }
}

export type Connector =
  | ApiKeyConnector<unknown, string>
  | OAuth2Connector<string>

// `Reconnect` stays in `tools/types.ts` so connectors and tool UI share one
// canonical shape without creating a circular dependency.
