import 'server-only'
import { z } from 'zod'
import { defineConnector } from './define-connector'

const vercelCredentialSchema = z.object({
  apiKey: z
    .string()
    .min(1, 'Required')
    .startsWith('vc_', 'Vercel API tokens start with "vc_"'),
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
      placeholder: 'vc_...',
      description:
        'Personal/team token from vercel.com/account/tokens. Stored encrypted at rest.',
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
