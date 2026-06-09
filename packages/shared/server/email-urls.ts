import 'server-only'

import { withRelatedProject } from '@vercel/related-projects'
import {
  LOCAL_PROJECT_ORIGINS,
  PROJECT_NAMES,
} from '../vercel-related-projects'

// VERCEL_RELATED_PROJECTS never includes the current project, so
// withRelatedProject falls back to localhost when an email targets the app
// that is sending it (e.g. waitlist invites sent from outname-app linking to
// /login). NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_WEB_URL are resolved per app by
// createOutnameNextConfig, which handles the current-project case, so they
// take precedence here.
function toConfiguredOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  try {
    return new URL(trimmed).origin
  } catch {
    return null
  }
}

/** App origin for transactional email links (login, settings). */
export function getEmailAppOrigin(): string {
  return (
    toConfiguredOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    withRelatedProject({
      defaultHost: LOCAL_PROJECT_ORIGINS.app,
      projectName: PROJECT_NAMES.app,
    })
  )
}

/** Marketing web origin for waitlist confirmation and hosted assets. */
export function getEmailWebOrigin(): string {
  return (
    toConfiguredOrigin(process.env.NEXT_PUBLIC_WEB_URL) ??
    withRelatedProject({
      defaultHost: LOCAL_PROJECT_ORIGINS.web,
      projectName: PROJECT_NAMES.web,
    })
  )
}

export function buildEmailAppUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return new URL(normalizedPath, getEmailAppOrigin()).toString()
}

export function buildEmailWebUrl(
  path: string,
  searchParams?: Record<string, string>
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(normalizedPath, getEmailWebOrigin())

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value)
    }
  }

  return url.toString()
}

export function getEmailAppLoginUrl(): string {
  return buildEmailAppUrl('/login')
}

export function getEmailWaitlistConfirmationUrl(token: string): string {
  return buildEmailWebUrl('/waitlist/confirm', { token })
}

export function getEmailWaitlistAdminUrl(): string {
  return buildEmailAppUrl('/settings/waitlist')
}
