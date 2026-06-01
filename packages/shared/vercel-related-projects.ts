const HOST_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?$/i
const HTTP_URL_PATTERN = /^https?:\/\//i

export const LOCAL_PROJECT_ORIGINS = {
  api: 'http://localhost:3001',
  app: 'http://localhost:3000',
  web: 'http://localhost:3002',
} as const

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
