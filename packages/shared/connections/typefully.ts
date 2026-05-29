import 'server-only'
import { isTypefullyPresignedUploadRequest } from '@outname/shared/server/typefully-upload-url'
import { z } from 'zod'
import { defineConnector } from './define-connector'

const typefullyCredentialSchema = z.object({
  apiKey: z.string().min(1, 'Required'),
})

export type TypefullyCredential = z.infer<typeof typefullyCredentialSchema>

function metadataFromMeResponse(payload: {
  id?: string
  name?: string
  username?: string
  email?: string
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      metadata[key] = value
    }
  }
  return metadata
}

export const typefullyConnector = defineConnector('typefully.api_key', {
  displayName: 'Typefully API',
  description:
    'Create, schedule, and publish social drafts via Typefully API v2.',
  credential: typefullyCredentialSchema,
  fields: [
    {
      name: 'apiKey',
      label: 'API key',
      type: 'password',
      placeholder: 'Paste your Typefully API key',
      description:
        'Generate in Typefully under Settings → API. It is encrypted at rest before storage.',
    },
  ],
  broker: {
    allowedHosts: ['api.typefully.com'] as const,
    injectedHeaderNames: ['authorization'] as const,
    injectedHeaders: (credential: TypefullyCredential) => ({
      authorization: `Bearer ${credential.apiKey}`,
    }),
    allowUnauthenticatedRequest: isTypefullyPresignedUploadRequest,
  },
  async validate(values) {
    const response = await fetch('https://api.typefully.com/v2/me', {
      headers: {
        authorization: `Bearer ${values.apiKey}`,
      },
    })

    if (!response.ok) {
      return {
        ok: false,
        error: `Typefully rejected the key (HTTP ${response.status}). Verify the key and try again.`,
      }
    }

    const profile = (await response.json()) as {
      id?: string
      name?: string
      username?: string
      email?: string
    }

    return {
      ok: true,
      metadata: metadataFromMeResponse(profile),
    }
  },
})
