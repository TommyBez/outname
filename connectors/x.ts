import 'server-only'
import { z } from 'zod'
import { defineConnector } from './define-connector'

const BEARER_PREFIX_PATTERN = /^bearer(?:\s+|$)/i
const WHITESPACE_PATTERN = /\s/

const xBearerTokenSchema = z.preprocess(
  (value) =>
    typeof value === 'string'
      ? value.trim().replace(BEARER_PREFIX_PATTERN, '')
      : value,
  z
    .string()
    .min(1, 'Required')
    .refine(
      (value) => !WHITESPACE_PATTERN.test(value),
      'Paste only the token value, without spaces.'
    )
)

const xCredentialSchema = z.object({
  bearerToken: xBearerTokenSchema,
})

export type XCredential = z.infer<typeof xCredentialSchema>

export const xConnector = defineConnector('x', {
  displayName: 'X API',
  description:
    'X API v2 access via app-only Bearer Tokens or OAuth 2.0 user access tokens.',
  credential: xCredentialSchema,
  fields: [
    {
      name: 'bearerToken',
      label: 'Bearer token',
      type: 'password',
      placeholder: 'Paste a Bearer or OAuth 2.0 access token',
      description:
        'Generate in the X Developer Console. OAuth 1.0a token secrets are not supported by this connector.',
    },
  ],
  broker: {
    allowedHosts: ['api.x.com'] as const,
    injectedHeaderNames: ['authorization'] as const,
    injectedHeaders: (credential: XCredential) => ({
      authorization: `Bearer ${credential.bearerToken}`,
    }),
  },
})
