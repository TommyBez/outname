import { LOCAL_PROJECT_ORIGINS } from './vercel-related-projects'

const DEFAULT_APP_URL = LOCAL_PROJECT_ORIGINS.app
const TRAILING_SLASHES = /\/+$/

export function getAppBaseUrl(): string {
  return normalizePublicUrl(process.env.NEXT_PUBLIC_APP_URL, DEFAULT_APP_URL)
}

export function getAppLoginUrl(from?: string): string {
  const loginUrl = new URL('/login', `${getAppBaseUrl()}/`)
  if (from) {
    loginUrl.searchParams.set('from', from)
  }
  return loginUrl.toString()
}

function normalizePublicUrl(
  value: string | undefined,
  fallback: string
): string {
  const trimmed = value?.trim()
  return (trimmed || fallback).replace(TRAILING_SLASHES, '')
}
