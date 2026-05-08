import 'server-only'
import { z } from 'zod'
import { defineConnector } from './define-connector'

const parallelCredentialSchema = z.object({
  apiKey: z.string().trim().min(1, 'Required'),
})

export type ParallelCredential = z.infer<typeof parallelCredentialSchema>

export const parallelConnector = defineConnector('parallel', {
  displayName: 'Parallel',
  description:
    'Current web search and LLM-optimized excerpts via the Parallel Search API.',
  credential: parallelCredentialSchema,
  fields: [
    {
      name: 'apiKey',
      label: 'API key',
      type: 'password',
      placeholder: 'Paste your Parallel API key',
      description:
        'Generate in the Parallel platform. The key is encrypted at rest before storage.',
    },
  ],
  broker: {
    allowedHosts: ['api.parallel.ai'] as const,
    injectedHeaderNames: ['x-api-key'] as const,
    injectedHeaders: (credential: ParallelCredential) => ({
      'x-api-key': credential.apiKey,
    }),
  },
})
