const HOST_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?$/i
const HTTP_URL_PATTERN = /^https?:\/\//i

/** Matches `app.outname.localhost` and worktree hosts like `fix-ui.app.outname.localhost`. */
const PORTLESS_APP_HOST_PATTERN =
  /^(?:([a-z0-9-]+)\.)?(api|app|web)\.outname\.localhost$/i

export const LOCALHOST_PROJECT_ORIGINS = {
  api: 'http://localhost:3001',
  app: 'http://localhost:3000',
  web: 'http://localhost:3002',
} as const

export const PORTLESS_PROJECT_ORIGINS = {
  api: 'https://api.outname.localhost',
  app: 'https://app.outname.localhost',
  web: 'https://web.outname.localhost',
} as const

export type LocalProjectOrigins = {
  readonly api: string
  readonly app: string
  readonly web: string
}

export type LocalProjectRole = keyof LocalProjectOrigins

/**
 * Derive sibling app origins from the Portless-injected public URL.
 * Preserves worktree branch prefixes (e.g. `fix-ui.app.outname.localhost`).
 */
export function derivePortlessOriginsFromUrl(
  portlessUrl: string
): LocalProjectOrigins | null {
  let url: URL
  try {
    url = new URL(portlessUrl)
  } catch {
    return null
  }

  const match = url.hostname.match(PORTLESS_APP_HOST_PATTERN)
  if (!match) {
    return null
  }

  const prefix = match[1]
  const portSuffix = url.port ? `:${url.port}` : ''

  const originFor = (role: LocalProjectRole): string => {
    const host = prefix
      ? `${prefix}.${role}.outname.localhost`
      : `${role}.outname.localhost`
    return `${url.protocol}//${host}${portSuffix}`
  }

  return {
    api: originFor('api'),
    app: originFor('app'),
    web: originFor('web'),
  }
}

export function resolveLocalProjectOrigins(): LocalProjectOrigins {
  if (process.env.PORTLESS === '0') {
    return LOCALHOST_PROJECT_ORIGINS
  }

  const portlessUrl = process.env.PORTLESS_URL?.trim()
  if (portlessUrl) {
    return derivePortlessOriginsFromUrl(portlessUrl) ?? PORTLESS_PROJECT_ORIGINS
  }

  return LOCALHOST_PROJECT_ORIGINS
}

/** Snapshot at module load; prefer `resolveLocalProjectOrigins()` at runtime. */
export const LOCAL_PROJECT_ORIGINS = resolveLocalProjectOrigins()

export const PROJECT_NAMES = {
  api: 'outname-api',
  app: 'outname-app',
  web: 'outname',
} as const

function toOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  let urlValue: string | null = null
  if (HTTP_URL_PATTERN.test(trimmed)) {
    urlValue = trimmed
  } else if (HOST_PATTERN.test(trimmed)) {
    urlValue = `https://${trimmed}`
  }

  if (!urlValue) {
    return null
  }

  try {
    return new URL(urlValue).origin
  } catch {
    return null
  }
}

export function getCurrentProjectOrigin(fallbackOrigin: string): string {
  if (process.env.VERCEL_ENV === 'preview') {
    return toOrigin(process.env.VERCEL_URL) ?? fallbackOrigin
  }

  if (process.env.VERCEL_ENV === 'production') {
    return (
      toOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
      toOrigin(process.env.VERCEL_URL) ??
      fallbackOrigin
    )
  }

  return fallbackOrigin
}
