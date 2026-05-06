import 'server-only'
import { z } from 'zod'
import { defineConnector } from './define-connector'

const WHITESPACE_PATTERN = /\s/

const vercelApiTokenSchema = z
  .string()
  .trim()
  .min(1, 'Required')
  .refine(
    (value) => !WHITESPACE_PATTERN.test(value),
    'Paste only the token value, without spaces.'
  )

const vercelCredentialSchema = z.object({
  apiKey: vercelApiTokenSchema,
})

export type VercelCredential = z.infer<typeof vercelCredentialSchema>

export const vercelConnector = defineConnector('vercel', {
  displayName: 'Vercel',
  description:
    'Vercel REST API connector used by the vercel.request maintainer tool.',
  credential: vercelCredentialSchema,
  fields: [
    {
      name: 'apiKey',
      label: 'API token',
      type: 'password',
      placeholder: 'vcp_..., vci_..., vca_..., or legacy vc_...',
      description:
        'Paste a Vercel personal, integration, or app token. Legacy "vc_" tokens still work, and the value is encrypted at rest before storage.',
    },
  ],
  broker: {
    allowedHosts: ['api.vercel.com'],
    injectedHeaderNames: ['authorization'],
    injectedHeaders: (credential: VercelCredential) => ({
      authorization: `Bearer ${credential.apiKey}`,
    }),
  },
})
