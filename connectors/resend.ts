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
  },
}

export function resendApiKey(raw: RawCredential): string {
  return (raw as ResendCredential).apiKey
}
