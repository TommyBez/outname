import 'server-only'

import { relatedProjects, withRelatedProject } from '@vercel/related-projects'
import {
  getCurrentProjectOrigin,
  LOCAL_PROJECT_ORIGINS,
  PROJECT_NAMES,
} from '../vercel-related-projects'

// Email origins resolve at runtime from Vercel system env vars only.
// VERCEL_RELATED_PROJECTS covers cross-project links (e.g. api → app login)
// but never lists the current project, so when the list is populated a miss
// means the email links back to the project sending it and the origin comes
// from the current deployment (VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL).
// When there is no related-project data at all (local dev, or a deployment
// with no relations configured), guessing another project's URL from this
// deployment's env would emit the sender's own origin, so the local default
// is returned instead.
function resolveEmailOrigin(project: 'app' | 'web'): string {
  const localOrigin = LOCAL_PROJECT_ORIGINS[project]

  const relatedOrigin = withRelatedProject({
    defaultHost: '',
    projectName: PROJECT_NAMES[project],
  })
  if (relatedOrigin) {
    return relatedOrigin
  }

  if (relatedProjects({ noThrow: true }).length > 0) {
    return getCurrentProjectOrigin(localOrigin)
  }

  return localOrigin
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
