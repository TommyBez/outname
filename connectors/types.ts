import type { z } from 'zod'

/**
 * Connector contract — the per-provider plumbing the platform calls to
 * obtain and broker API-key credentials. OAuth/MCP remain deferred, but
 * the discriminator is intentionally preserved so the union can widen
 * later without reshaping callers.
 *
 *   tool author    -> chooses provider + config layer
 *   connector      -> validates and describes credential form fields
 *   broker runtime -> injects headers outside the tool sandbox VM
 */

/**
 * Opaque, connector-private credential payload. The runtime stores it
 * AES-256-GCM-encrypted via `lib/connection-crypto.ts` and never
 * inspects it; only the originating connector understands the shape.
 *
 * Tools never receive this value directly. The broker runtime decrypts
 * it inside a server-only step, validates it through the connector's
 * schema, and converts it into network-policy injected headers.
 */
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
  /**
   * Exact HTTPS hosts this connector may authenticate against. v1 does
   * not allow wildcard transforms because those make exfiltration
   * boundaries harder to audit.
   */
  allowedHosts: readonly string[]
  /**
   * Convert decrypted connector credentials into HTTP headers injected
   * by Vercel Sandbox network policy. These bytes never enter the VM.
   */
  injectedHeaders(credential: TCredential): Record<string, string>
  /** Optional provider-specific response cap. Broker has a global default. */
  maxResponseBytes?: number
}

export interface ApiKeyConnector<
  TCredential = Record<string, unknown>,
  TProvider extends string = string,
> {
  apiKey: {
    /**
     * Zod schema covering ONLY credential fields (the secret + any
     * adjuncts strictly required to dial the API). Non-credential
     * knobs — Resend `fromEmail`, Stripe `accountId`, ... — belong to
     * `tool.configSchema`, not to the connector form.
     */
    formSchema: z.ZodType<TCredential>
    fields: ApiKeyFieldDescriptor[]
    /**
     * Optional cheap probe (e.g. `GET /me`) to fail invalid keys
     * during the form submit instead of at first use. Returning
     * `metadata` lets the connector enrich the row (account id,
     * region, ...).
     */
    validate?(values: Record<string, string>): Promise<ApiKeyValidateResult>
  }
  broker: ConnectorBroker<TCredential>
  description: string
  displayName: string
  kind: 'api_key'
  provider: TProvider
}

export type Connector = ApiKeyConnector<unknown, string>

// `Reconnect` lives in `tools/types.ts` — the system prompt and the
// catalog UI both consume it directly from there. Connector code
// imports it from `tools/types.ts` to avoid a circular dependency
// loop while still sharing one canonical shape.
