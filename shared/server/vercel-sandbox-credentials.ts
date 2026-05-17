export interface VercelSandboxCredentials {
  projectId: string
  teamId: string
  token: string
}

function missingCredentialsMessage(missing: readonly string[]): string {
  const missingList = missing.join(', ')
  return [
    `Incomplete Vercel sandbox credentials: missing ${missingList}.`,
    'Set `VERCEL_TOKEN` together with `VERCEL_PROJECT_ID` and `VERCEL_TEAM_ID`, or run `vercel link` and `vercel env pull`.',
  ].join(' ')
}

function localMissingCredentialsMessage(): string {
  return [
    'Vercel Sandbox requires non-interactive credentials in local workflow runs.',
    'Set `VERCEL_OIDC_TOKEN`, or set `VERCEL_TOKEN` together with `VERCEL_PROJECT_ID` and `VERCEL_TEAM_ID`.',
    'For local development, run `vercel link` and `vercel env pull`.',
  ].join(' ')
}

export function resolveExplicitSandboxCredentials(
  input: { env?: Record<string, string | undefined> } = {}
): VercelSandboxCredentials | null {
  const env = input.env ?? process.env
  const apiToken = env.VERCEL_TOKEN ?? env.VERCEL_ACCESS_TOKEN
  const oidcToken = env.VERCEL_OIDC_TOKEN
  const projectId = env.VERCEL_PROJECT_ID ?? ''
  const teamId = env.VERCEL_TEAM_ID ?? ''

  if (apiToken) {
    const missing: string[] = []
    if (!projectId) {
      missing.push('VERCEL_PROJECT_ID')
    }
    if (!teamId) {
      missing.push('VERCEL_TEAM_ID')
    }
    if (missing.length > 0) {
      throw new Error(missingCredentialsMessage(missing))
    }
    return {
      projectId,
      teamId,
      token: apiToken,
    }
  }

  if (oidcToken || env.VERCEL_URL) {
    return null
  }

  if (env.NODE_ENV !== 'production') {
    throw new Error(localMissingCredentialsMessage())
  }

  return null
}
