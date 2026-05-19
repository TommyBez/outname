import 'server-only'
import { z } from 'zod'
import { defineConnector } from './define-connector'

const CONTEXT7_POLICIES_URL = 'https://context7.com/api/v2/policies'
const WHITESPACE_PATTERN = /\s/

const context7CredentialSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(1, 'Required')
    .refine(
      (value) => !WHITESPACE_PATTERN.test(value),
      'Paste only the API key value, without spaces.'
    )
    .refine(
      (value) => value.startsWith('ctx7sk'),
      'Context7 API keys start with "ctx7sk".'
    ),
})

export type Context7Credential = z.infer<typeof context7CredentialSchema>

function metadataFromPolicies(payload: {
  accessibleLibraryCount?: unknown
  libraryFilters?: { mode?: unknown }
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  if (typeof payload.accessibleLibraryCount === 'number') {
    metadata.accessibleLibraryCount = payload.accessibleLibraryCount
  }
  if (typeof payload.libraryFilters?.mode === 'string') {
    metadata.filterMode = payload.libraryFilters.mode
  }
  return metadata
}

export const context7Connector = defineConnector('context7', {
  displayName: 'Context7 API',
  description:
    'Search libraries and fetch up-to-date documentation context through the Context7 API.',
  credential: context7CredentialSchema,
  fields: [
    {
      name: 'apiKey',
      label: 'API key',
      type: 'password',
      placeholder: 'ctx7sk_...',
      description:
        'Create an API key in the Context7 dashboard. The value is encrypted at rest before storage.',
    },
  ],
  broker: {
    allowedHosts: ['context7.com'] as const,
    injectedHeaderNames: ['authorization'] as const,
    injectedHeaders: (credential: Context7Credential) => ({
      authorization: `Bearer ${credential.apiKey}`,
    }),
  },
  async validate(values) {
    const response = await fetch(CONTEXT7_POLICIES_URL, {
      headers: {
        authorization: `Bearer ${values.apiKey}`,
      },
    })

    if (!response.ok) {
      return {
        ok: false,
        error: `Context7 rejected the API key (HTTP ${response.status}). Verify the key and try again.`,
      }
    }

    const policies = (await response.json()) as {
      accessibleLibraryCount?: unknown
      libraryFilters?: { mode?: unknown }
    }

    return {
      ok: true,
      metadata: metadataFromPolicies(policies),
    }
  },
})
