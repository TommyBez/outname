import type { z } from 'zod'

/**
 * Connector contract — the per-provider plumbing the platform calls to
 * obtain, refresh, and revoke credentials. Connectors are intentionally
 * generic OAuth 2.0 / api_key adapters: they hold no opinions about
 * which scopes a tool needs, what shape `metadata` takes, or which
 * tools sit on top of them. Those are tool-author concerns.
 *
 *   tool author    -> chooses provider + scopes + config layer
 *   connector      -> exchanges, refreshes, revokes credentials
 *   runtime        -> persists, resolves, surfaces reconnect reasons
 */

/**
 * Opaque, connector-private credential payload. The runtime stores it
 * AES-256-GCM-encrypted via `lib/connection-crypto.ts` and never
 * inspects it; only the originating connector understands the shape.
 *
 * Tools receive the decrypted `RawCredential` through
 * `ToolBuildContext.credentials[provider]`.
 */
export type RawCredential = unknown

/**
 * Result of every successful OAuth credential mint — both initial code
 * exchange and subsequent refreshes return this shape so the runtime
 * has a single persistence path.
 *
 *   `raw`            connector-private credential payload
 *   `expiresAt`      ISO-8601 string, or null when the credential has
 *                    no expiry (e.g. some long-lived API keys)
 *   `grantedScopes`  scopes the provider actually granted; runtime uses
 *                    these for scope-gap detection. Connectors MUST
 *                    parse this from the token response, not from the
 *                    request — providers are free to grant more or
 *                    fewer scopes than were requested.
 *   `metadata`       free-form, connector-defined. Common entries:
 *                    `email`, `accountId`. Persisted as-is into
 *                    `user_connections.metadata`.
 */
export interface OAuthExchangeResult {
  raw: RawCredential
  expiresAt: string | null
  grantedScopes: string[]
  metadata: Record<string, unknown>
}

export interface OAuthBuildAuthorizeUrlArgs {
  state: string
  redirectUri: string
  /**
   * Opaque set of provider-defined scope strings. The runtime computes
   * this server-side as the union of scopes required by the agent's
   * attached tools — connectors NEVER inject defaults of their own.
   */
  scopes: string[]
}

export interface OAuthExchangeCodeArgs {
  code: string
  redirectUri: string
}

export interface OAuthConnector {
  provider: string
  kind: 'oauth'
  displayName: string
  description: string
  oauth: {
    buildAuthorizeUrl(args: OAuthBuildAuthorizeUrlArgs): string
    exchangeCode(args: OAuthExchangeCodeArgs): Promise<OAuthExchangeResult>
    refresh(raw: RawCredential): Promise<OAuthExchangeResult>
    revoke?(raw: RawCredential): Promise<void>
  }
}

export interface ApiKeyFieldDescriptor {
  name: string
  label: string
  type: 'text' | 'password'
  placeholder?: string
  description?: string
}

export interface ApiKeyValidateResult {
  ok: boolean
  error?: string
  metadata?: Record<string, unknown>
}

export interface ApiKeyConnector {
  provider: string
  kind: 'api_key'
  displayName: string
  description: string
  apiKey: {
    /**
     * Zod schema covering ONLY credential fields (the secret + any
     * adjuncts strictly required to dial the API). Non-credential
     * knobs — Resend `fromEmail`, Stripe `accountId`, ... — belong to
     * `tool.configSchema`, not to the connector form.
     */
    formSchema: z.ZodTypeAny
    fields: ApiKeyFieldDescriptor[]
    /**
     * Optional cheap probe (e.g. `GET /me`) to fail invalid keys
     * during the form submit instead of at first use. Returning
     * `metadata` lets the connector enrich the row (account id,
     * region, ...).
     */
    validate?(values: Record<string, string>): Promise<ApiKeyValidateResult>
  }
}

export type Connector = OAuthConnector | ApiKeyConnector

/**
 * Discriminated reason a tool isn't currently runnable. Surfaces in:
 *   - the system prompt's "Tools needing attention" block,
 *   - the catalog UI's per-row status,
 *   - per-tool actions (Reconnect / Re-attach / Detach).
 *
 * Provider-keyed reasons (missing/expired/revoked/scope_gap) drive an
 * OAuth re-auth or api_key re-submit. Tool-keyed reasons
 * (config_invalid/build_failed/tool_removed) drive a Re-attach or
 * Detach action.
 */
export type Reconnect =
  | { provider: string; toolId: string; reason: 'missing_credential' }
  | { provider: string; toolId: string; reason: 'expired' }
  | { provider: string; toolId: string; reason: 'revoked' }
  | {
      provider: string
      toolId: string
      reason: 'scope_gap'
      neededScopes: string[]
    }
  | { toolId: string; reason: 'config_invalid'; details?: string }
  | { toolId: string; reason: 'build_failed'; details?: string }
  | { toolId: string; reason: 'tool_removed' }
