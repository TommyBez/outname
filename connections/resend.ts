import 'server-only'
import { z } from 'zod'
import { defineConnector } from './define-connector'

const resendCredentialSchema = z.object({
  apiKey: z
    .string()
    .min(1, 'Required')
    .startsWith('re_', 'Resend API keys start with "re_"'),
})

export type ResendCredential = z.infer<typeof resendCredentialSchema>

export const resendConnector = defineConnector('resend', {
  displayName: 'Resend',
  description: 'Transactional email via Resend. Used by the resend.send tool.',
  credential: resendCredentialSchema,
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
  broker: {
    allowedHosts: ['api.resend.com'] as const,
    injectedHeaderNames: ['authorization'] as const,
    injectedHeaders: (credential: ResendCredential) => ({
      authorization: `Bearer ${credential.apiKey}`,
    }),
  },
})
