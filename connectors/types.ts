import type { z } from 'zod'

/**
 * Connector contract — the per-provider plumbing the platform calls to
 * obtain API-key credentials. OAuth is intentionally deferred past
 * Phase 3; this contract only covers simple form-driven secrets.
 *
 *   tool author    -> chooses provider + config layer
 *   connector      -> validates and describes credential form fields
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

export interface ApiKeyConnector {
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
  description: string
  displayName: string
  kind: 'api_key'
  provider: string
}

export type Connector = ApiKeyConnector

// `Reconnect` lives in `tools/types.ts` — the system prompt and the
// catalog UI both consume it directly from there. Connector code
// imports it from `tools/types.ts` to avoid a circular dependency
// loop while still sharing one canonical shape.
