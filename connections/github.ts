import 'server-only'
import { z } from 'zod'
import { defineConnector } from './define-connector'

const BEARER_PREFIX_PATTERN = /^bearer(?:\s+|$)/i
const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const WHITESPACE_PATTERN = /\s/

const githubTokenSchema = z.preprocess(
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

const githubCredentialSchema = z.object({
  token: githubTokenSchema,
})

export type GitHubCredential = z.infer<typeof githubCredentialSchema>

export function githubGitInjectedHeaders(
  credential: GitHubCredential
): Record<string, string> {
  return {
    authorization: `Basic ${Buffer.from(
      `x-access-token:${credential.token}`,
      'utf8'
    ).toString('base64')}`,
  }
}

function metadataFromGitHubUser(payload: {
  email?: string | null
  id?: number
  login?: string
  name?: string | null
}) {
  const metadata: Record<string, unknown> = {}
  if (payload.login) {
    metadata.login = payload.login
  }
  if (payload.id !== undefined) {
    metadata.id = payload.id
  }
  if (payload.name) {
    metadata.name = payload.name
  }
  if (payload.email) {
    metadata.email = payload.email
  }
  return metadata
}

export const githubConnector = defineConnector('github', {
  displayName: 'GitHub',
  description:
    'GitHub REST API connector used by maintainer tools that work with private repositories and pull requests.',
  credential: githubCredentialSchema,
  fields: [
    {
      name: 'token',
      label: 'Personal access token',
      type: 'password',
      placeholder: 'ghp_..., gho_..., github_pat_..., or similar',
      description:
        'Paste a GitHub token with repository read/write access for the repositories you want the tool to edit. The token is encrypted at rest before storage.',
    },
  ],
  broker: {
    allowedHosts: ['api.github.com'],
    injectedHeaderNames: ['authorization'],
    injectedHeaders: (credential: GitHubCredential) => ({
      authorization: `Bearer ${credential.token}`,
    }),
    maxResponseBytes: 64 * 1024,
  },
  async validate(values) {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${values.token}`,
        'x-github-api-version': GITHUB_API_VERSION,
      },
    })
    if (!response.ok) {
      return {
        ok: false,
        error: `GitHub rejected the token (HTTP ${response.status}). Verify the token scopes and try again.`,
      }
    }

    const user = (await response.json()) as {
      email?: string | null
      id?: number
      login?: string
      name?: string | null
    }

    return {
      ok: true,
      metadata: metadataFromGitHubUser(user),
    }
  },
})
