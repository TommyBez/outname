import 'server-only'
import { z } from 'zod'
import { defineConnector } from './define-connector'

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

export const v0Connector = defineConnector('v0', {
  displayName: 'v0 Platform API',
  description:
    'v0 Platform API connector used by the v0 AI Tools maintainer tool.',
  credential: v0CredentialSchema,
  fields: [
    {
      name: 'apiKey',
      label: 'API key',
      type: 'password',
      placeholder: 'Paste your v0 API key',
      description:
        'Generate a v0 Platform API key in the v0 dashboard. The key is encrypted at rest before storage.',
    },
  ],
  broker: {
    allowedHosts: ['api.v0.dev'],
    injectedHeaderNames: ['authorization'],
    injectedHeaders: (credential: V0Credential) => ({
      authorization: `Bearer ${credential.apiKey}`,
    }),
    maxResponseBytes: 512 * 1024,
  },
  async validate(values) {
    const response = await fetch('https://api.v0.dev/v1/user', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${values.apiKey}`,
      },
    })
    if (!response.ok) {
      return {
        ok: false,
        error:
          response.status === 401 || response.status === 403
            ? 'v0 rejected this API key.'
            : `v0 validation failed with HTTP ${response.status}.`,
      }
    }
    const body = (await response.json()) as {
      email?: unknown
      id?: unknown
      name?: unknown
    }
    return {
      ok: true,
      metadata: {
        email: typeof body.email === 'string' ? body.email : null,
        id: typeof body.id === 'string' ? body.id : null,
        name: typeof body.name === 'string' ? body.name : null,
      },
    }
  },
})
