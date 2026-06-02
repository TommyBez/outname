const TRAILING_SLASHES = /\/+$/

export function getAppBaseUrl(): string {
  return normalizePublicUrl(process.env.NEXT_PUBLIC_APP_URL)
}

export function buildAppUrl(
  path: string,
  searchParams?: Record<string, string>
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(normalizedPath, `${getAppBaseUrl()}/`)

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value)
    }
  }

  return url.toString()
}

export function getAppLoginUrl(from?: string): string {
  return buildAppUrl('/login', from ? { from } : undefined)
}

function normalizePublicUrl(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL must be set by createOutnameNextConfig.'
    )
  }

  return trimmed.replace(TRAILING_SLASHES, '')
}
