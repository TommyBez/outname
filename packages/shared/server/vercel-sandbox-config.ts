import type { Sandbox } from '@vercel/sandbox'

const APP_TAG = 'outname'
const DEFAULT_ENV_TAG = 'development'
const PERSISTENT_SANDBOX_SNAPSHOT_EXPIRATION_MS = 0
const SANDBOX_CREDENTIAL_KEYS = [
  'SANDBOX_TEAM_ID',
  'SANDBOX_PROJECT_ID',
  'SANDBOX_ACCESS_TOKEN',
] as const

type SandboxCreateOptions = NonNullable<Parameters<typeof Sandbox.create>[0]>
type SandboxCreateOptionsWithCredentials = Extract<
  SandboxCreateOptions,
  {
    projectId: string
    teamId: string
    token: string
  }
>
type SandboxCredentialKey = (typeof SANDBOX_CREDENTIAL_KEYS)[number]
export type VercelSandboxCredentials = Pick<
  SandboxCreateOptionsWithCredentials,
  'projectId' | 'teamId' | 'token'
>
export const PERSISTENT_SANDBOX_RETENTION_OPTIONS = {
  keepLastSnapshots: {
    count: 1,
    deleteEvicted: true,
  },
  snapshotExpiration: PERSISTENT_SANDBOX_SNAPSHOT_EXPIRATION_MS,
} as const
type VercelSandboxAuthenticatedOptions<TOptions extends object> = TOptions &
  SandboxCreateOptionsWithCredentials

function sandboxEnv(): string {
  return (
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    process.env.SANDBOX_ENV ??
    DEFAULT_ENV_TAG
  )
}

function baseSandboxTags(): Record<string, string> {
  return {
    app: APP_TAG,
    env: sandboxEnv(),
  }
}

function requiredSandboxCredential(key: SandboxCredentialKey): string {
  const value = process.env[key]?.trim()
  if (value) {
    return value
  }

  throw new Error(
    `Missing ${key}. Configure explicit Vercel Sandbox authentication with ${SANDBOX_CREDENTIAL_KEYS.join(', ')}.`
  )
}

export function getVercelSandboxCredentials(): VercelSandboxCredentials {
  return {
    projectId: requiredSandboxCredential('SANDBOX_PROJECT_ID'),
    teamId: requiredSandboxCredential('SANDBOX_TEAM_ID'),
    token: requiredSandboxCredential('SANDBOX_ACCESS_TOKEN'),
  }
}

export function withVercelSandboxCredentials<TOptions extends object>(
  options: TOptions
): VercelSandboxAuthenticatedOptions<TOptions> {
  return {
    ...options,
    ...getVercelSandboxCredentials(),
  } as VercelSandboxAuthenticatedOptions<TOptions>
}

export function systemSandboxTags(agentId: string): Record<string, string> {
  return {
    ...baseSandboxTags(),
    kind: 'agent-system',
    agentId,
  }
}

export function skillSandboxTags(agentId: string): Record<string, string> {
  return {
    ...baseSandboxTags(),
    kind: 'agent-skills',
    agentId,
  }
}

export function toolRuntimeSandboxTags(input: {
  manifestId: string
  runId: string
}): Record<string, string> {
  return {
    ...baseSandboxTags(),
    kind: 'tool-runtime',
    manifestId: input.manifestId,
    runId: input.runId,
  }
}

export function toolBuildSandboxTags(input: {
  buildId: string
  manifestId: string
}): Record<string, string> {
  return {
    ...baseSandboxTags(),
    kind: 'tool-build',
    manifestId: input.manifestId,
    buildId: input.buildId,
  }
}

export function brokeredHttpSandboxTags(input: {
  connectorId: string
  runId: string
}): Record<string, string> {
  return {
    ...baseSandboxTags(),
    kind: 'brokered-http',
    connectorId: input.connectorId,
    runId: input.runId,
  }
}

export function repoWorkspaceSandboxTags(input: {
  attachmentToolId: string
  runId: string
}): Record<string, string> {
  return {
    ...baseSandboxTags(),
    kind: 'repo-workspace',
    attachmentToolId: input.attachmentToolId,
    runId: input.runId,
  }
}
