import 'server-only'

import { withRelatedProject } from '@vercel/related-projects'
import {
  getCurrentProjectOrigin,
  LOCAL_PROJECT_ORIGINS,
  PROJECT_NAMES,
} from '../vercel-related-projects'

// VERCEL_RELATED_PROJECTS only lists *other* projects, never the current one,
// so an empty related-project resolution normally means the email links back
// to the project that is sending it (e.g. waitlist invites sent from
// outname-app linking to /login). In that case the origin comes from the
// current deployment's system env vars (VERCEL_PROJECT_PRODUCTION_URL /
// VERCEL_URL), and outside Vercel from the local default.
function resolveEmailOrigin(project: 'app' | 'web'): string {
  const relatedOrigin = withRelatedProject({
    defaultHost: '',
    projectName: PROJECT_NAMES[project],
  })
  return (
    relatedOrigin || getCurrentProjectOrigin(LOCAL_PROJECT_ORIGINS[project])
  )
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
