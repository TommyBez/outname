import 'server-only'
import { z } from 'zod'
import { defineConnector } from './define-connector'

const posthogCredentialSchema = z.object({
  apiKey: z.string().min(1, 'Required'),
  projectId: z.string().min(1, 'Required'),
})

export type PosthogCredential = z.infer<typeof posthogCredentialSchema>

export const posthogConnector = defineConnector('posthog', {
  displayName: 'PostHog',
  description: 'PostHog API connector for analytics, events, and project data.',
  credential: posthogCredentialSchema,
  fields: [
    {
      name: 'apiKey',
      label: 'Personal API key',
      type: 'password',
      placeholder: 'phx_... or personal key',
      description:
        'Create in PostHog settings. The key is encrypted at rest before storage.',
    },
    {
      name: 'projectId',
      label: 'Project ID',
      type: 'text',
      placeholder: '12345',
      description:
        'Numeric project id used for project-scoped endpoints under /api/projects/{id}/.',
    },
  ],
  broker: {
    allowedHosts: ['us.i.posthog.com', 'eu.i.posthog.com'] as const,
    injectedHeaderNames: ['authorization'] as const,
    injectedHeaders: (credential: PosthogCredential) => ({
      authorization: `Bearer ${credential.apiKey}`,
    }),
  },
})
