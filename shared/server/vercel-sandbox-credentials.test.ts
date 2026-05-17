import { expect, test } from 'vitest'
import { resolveExplicitSandboxCredentials } from './vercel-sandbox-credentials'

test('returns explicit credentials when token, project, and team are set', () => {
  expect(
    resolveExplicitSandboxCredentials({
      env: {
        NODE_ENV: 'development',
        VERCEL_PROJECT_ID: 'prj_123',
        VERCEL_TEAM_ID: 'team_123',
        VERCEL_TOKEN: 'token_123',
      },
    })
  ).toEqual({
    projectId: 'prj_123',
    teamId: 'team_123',
    token: 'token_123',
  })
})

test('throws when a personal token is present without project scope', () => {
  expect(() =>
    resolveExplicitSandboxCredentials({
      env: {
        NODE_ENV: 'development',
        VERCEL_TOKEN: 'token_123',
      },
    })
  ).toThrow(/VERCEL_PROJECT_ID/u)
})

test('allows OIDC-backed runtimes to keep using SDK-managed credentials', () => {
  expect(
    resolveExplicitSandboxCredentials({
      env: {
        NODE_ENV: 'development',
        VERCEL_OIDC_TOKEN: 'oidc-token',
      },
    })
  ).toBeNull()
})

test('fails fast in local development without non-interactive credentials', () => {
  expect(() =>
    resolveExplicitSandboxCredentials({
      env: {
        NODE_ENV: 'development',
      },
    })
  ).toThrow(/non-interactive credentials/u)
})
