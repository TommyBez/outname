const TRAILING_SLASH_PATTERN = /\/$/

export function apiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''
  if (!baseUrl) {
    return path
  }
  return `${baseUrl.replace(TRAILING_SLASH_PATTERN, '')}${path.startsWith('/') ? path : `/${path}`}`
}
