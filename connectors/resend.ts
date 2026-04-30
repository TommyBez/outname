import 'server-only'
import { z } from 'zod'
import type { ApiKeyConnector, RawCredential } from './types'

/**
 * Resend api_key connector. Holds the raw API key only — the
 * `fromEmail` knob lives on the `resend.send` tool's `configSchema`
 * (attachment-config layer) so the same key can back attachments
 * sending from different addresses.
 */

const resendCredentialSchema = z.object({
  apiKey: z
    .string()
    .min(1, 'Required')
    .startsWith('re_', 'Resend API keys start with "re_"'),
})

export type ResendCredential = z.infer<typeof resendCredentialSchema>

export const resendConnector: ApiKeyConnector = {
  provider: 'resend',
  kind: 'api_key',
  displayName: 'Resend',
  description: 'Transactional email via Resend. Used by the resend.send tool.',
  apiKey: {
    formSchema: resendCredentialSchema,
    fields: [
      {
        name: 'apiKey',
        label: 'API key',
        type: 'password',
        placeholder: 're_...',
        description:
          'Generate at resend.com/api-keys. The key is encrypted at rest before storage.',
      },
    ],
    async validate(values) {
      const parsed = resendCredentialSchema.safeParse(values)
      if (!parsed.success) {
        return {
          ok: false,
          error: parsed.error.issues[0]?.message ?? 'Invalid API key',
        }
      }
      // Cheap probe: list domains. Validates the key without sending.
      const res = await fetch('https://api.resend.com/domains', {
        headers: { authorization: `Bearer ${parsed.data.apiKey}` },
      })
      if (!res.ok) {
        return {
          ok: false,
          error: `Resend rejected the key (HTTP ${res.status}). Double-check it and try again.`,
        }
      }
      return { ok: true, metadata: {} }
    },
  },
}

export function resendApiKey(raw: RawCredential): string {
  return (raw as ResendCredential).apiKey
}
