import 'server-only'

import { z } from 'zod'
import { defineConnector } from './define-connector'

const V0_API_BASE_URL = 'https://api.v0.dev'
const WHITESPACE_PATTERN = /\s/

const v0ApiKeySchema = z
  .string()
  .trim()
  .min(1, 'Required')
  .refine(
    (value) => !WHITESPACE_PATTERN.test(value),
    'Paste only the API key value, without spaces.'
  )

const v0CredentialSchema = z.object({
  apiKey: v0ApiKeySchema,
})

export type V0Credential = z.infer<typeof v0CredentialSchema>

function metadataFromUser(payload: {
  email?: string
  id?: string
  name?: string
  username?: string
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      metadata[key] = value
    }
  }
  return metadata
}

export const v0Connector = defineConnector('v0', {
  displayName: 'v0 Platform',
  description:
    'v0 Platform API connector used by the v0 Platform maintainer tool bundle.',
  credential: v0CredentialSchema,
  fields: [
    {
      name: 'apiKey',
      label: 'API key',
      type: 'password',
      placeholder: 'Paste your v0 API key',
      description:
        'Create an API key in your v0 account settings. The value is encrypted at rest before storage.',
    },
  ],
  broker: {
    allowedHosts: ['api.v0.dev'],
    injectedHeaderNames: ['authorization'],
    injectedHeaders: (credential: V0Credential) => ({
      authorization: `Bearer ${credential.apiKey}`,
    }),
  },
  async validate(values) {
    const response = await fetch(`${V0_API_BASE_URL}/v1/user`, {
      headers: {
        authorization: `Bearer ${values.apiKey}`,
      },
    })
    if (!response.ok) {
      return {
        ok: false,
        error: `v0 rejected the key (HTTP ${response.status}). Verify the key and try again.`,
      }
    }

    const user = (await response.json()) as {
      email?: string
      id?: string
      name?: string
      username?: string
    }

    return {
      ok: true,
      metadata: metadataFromUser(user),
    }
  },
})
