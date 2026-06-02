import { afterEach, describe, expect, it } from 'vitest'
import {
  getVercelSandboxCredentials,
  withVercelSandboxCredentials,
} from './vercel-sandbox-config'

const CREDENTIAL_ENV_KEYS = [
  'SANDBOX_TEAM_ID',
  'SANDBOX_PROJECT_ID',
  'SANDBOX_ACCESS_TOKEN',
] as const
const MISSING_PROJECT_ID_ERROR = /SANDBOX_PROJECT_ID/u

const originalEnv = Object.fromEntries(
  CREDENTIAL_ENV_KEYS.map((key) => [key, process.env[key]])
) as Record<(typeof CREDENTIAL_ENV_KEYS)[number], string | undefined>

function restoreEnv(): void {
  for (const key of CREDENTIAL_ENV_KEYS) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function setSandboxCredentialEnv(): void {
  process.env.SANDBOX_TEAM_ID = ' team_123 '
  process.env.SANDBOX_PROJECT_ID = ' prj_123 '
  process.env.SANDBOX_ACCESS_TOKEN = ' token_123 '
}

afterEach(() => {
  restoreEnv()
})

describe('getVercelSandboxCredentials', () => {
  it('reads and trims explicit Vercel Sandbox credentials', () => {
    setSandboxCredentialEnv()

    expect(getVercelSandboxCredentials()).toEqual({
      projectId: 'prj_123',
      teamId: 'team_123',
      token: 'token_123',
    })
  })

  it('fails when a required credential is missing', () => {
    setSandboxCredentialEnv()
    delete process.env.SANDBOX_PROJECT_ID

    expect(() => getVercelSandboxCredentials()).toThrow(
      MISSING_PROJECT_ID_ERROR
    )
  })
})

describe('withVercelSandboxCredentials', () => {
  it('preserves sandbox options and adds explicit credentials', () => {
    setSandboxCredentialEnv()

    expect(
      withVercelSandboxCredentials({
        runtime: 'node24',
        timeout: 60_000,
      })
    ).toEqual({
      projectId: 'prj_123',
      runtime: 'node24',
      teamId: 'team_123',
      timeout: 60_000,
      token: 'token_123',
    })
  })
})
