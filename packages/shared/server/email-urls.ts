import 'server-only'

import { withRelatedProject } from '@vercel/related-projects'
import {
  getCurrentProjectOrigin,
  LOCAL_PROJECT_ORIGINS,
  PROJECT_NAMES,
} from '../vercel-related-projects'

// Email origins resolve at runtime, in order:
// 1. VERCEL_RELATED_PROJECTS — cross-project links (e.g. api → app login).
//    The list never includes the current project, so a miss usually means the
//    email links back to the project that is sending it.
// 2. NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_WEB_URL — computed per app by
//    createOutnameNextConfig. Covers the current-project case and, when a
//    related-project link is missing on Vercel, keeps the failure on the
//    build-time value instead of silently emitting the sender's own origin
//    (e.g. api links pointing at the api host).
// 3. Current deployment system env vars (VERCEL_PROJECT_PRODUCTION_URL /
//    VERCEL_URL) for non-Next contexts, then the local dev default.
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

function resolveEmailOrigin(project: 'app' | 'web'): string {
  const relatedOrigin = withRelatedProject({
    defaultHost: '',
    projectName: PROJECT_NAMES[project],
  })
  if (relatedOrigin) {
    return relatedOrigin
  }

  const configuredOrigin = toConfiguredOrigin(
    project === 'app'
      ? process.env.NEXT_PUBLIC_APP_URL
      : process.env.NEXT_PUBLIC_WEB_URL
  )
  if (configuredOrigin) {
    return configuredOrigin
  }

  return getCurrentProjectOrigin(LOCAL_PROJECT_ORIGINS[project])
}

/** App origin for transactional email links (login, settings). */
export function getEmailAppOrigin(): string {
  return resolveEmailOrigin('app')
}

/** Marketing web origin for waitlist confirmation and hosted assets. */
export function getEmailWebOrigin(): string {
  return resolveEmailOrigin('web')
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
