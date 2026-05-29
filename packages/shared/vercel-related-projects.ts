import {
  relatedProjects,
  type VercelRelatedProject,
} from '@vercel/related-projects'

const HOST_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?$/i
const HTTP_URL_PATTERN = /^https?:\/\//i

export const VERCEL_PROJECT_IDS = {
  admin: 'prj_Szw83dkoKByGB3DJb2AmmcrEpoEy',
  api: 'prj_Jd3B9bnvYTqq5kzj5qZrrVAmpTHX',
  app: 'prj_L9uLdZaSpoiY9pcIMazwhYQ2X5bG',
  web: 'prj_k8JEeBeWTnlZ0FQy7WV1rNqr5EgU',
} as const

export const VERCEL_PROJECT_NAMES = {
  admin: 'outname-admin',
  api: 'outname-api',
  app: 'outname-app',
  web: 'outname',
} as const

export const VERCEL_API_PROJECT_IDENTIFIERS = [
  VERCEL_PROJECT_IDS.api,
  VERCEL_PROJECT_NAMES.api,
] as const

export const VERCEL_APP_PROJECT_IDENTIFIERS = [
  VERCEL_PROJECT_IDS.app,
  VERCEL_PROJECT_NAMES.app,
] as const

export const VERCEL_FRONTEND_PROJECT_IDENTIFIERS = [
  VERCEL_PROJECT_IDS.admin,
  VERCEL_PROJECT_IDS.app,
  VERCEL_PROJECT_IDS.web,
  VERCEL_PROJECT_NAMES.admin,
  VERCEL_PROJECT_NAMES.app,
  VERCEL_PROJECT_NAMES.web,
] as const

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

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

function projectMatchesIdentifiers(
  project: VercelRelatedProject,
  identifiers: readonly string[]
): boolean {
  return (
    identifiers.includes(project.project.id) ||
    identifiers.includes(project.project.name)
  )
}

function getProjectOrigin(project: VercelRelatedProject): string | null {
  if (process.env.VERCEL_ENV === 'preview') {
    return toOrigin(project.preview.customEnvironment ?? project.preview.branch)
  }

  if (process.env.VERCEL_ENV === 'production') {
    return toOrigin(project.production.alias ?? project.production.url)
  }

  return toOrigin(
    project.preview.customEnvironment ??
      project.preview.branch ??
      project.production.alias ??
      project.production.url
  )
}

export function getRelatedProjectOrigins(
  identifiers?: readonly string[]
): string[] {
  const projects = relatedProjects({ noThrow: true })
  const matchingProjects = identifiers
    ? projects.filter((project) =>
        projectMatchesIdentifiers(project, identifiers)
      )
    : projects

  return unique(
    matchingProjects
      .map((project) => getProjectOrigin(project))
      .filter((origin): origin is string => Boolean(origin))
  )
}

export function getRelatedProjectOrigin(
  identifiers: readonly string[]
): string | null {
  const matchingOrigins = getRelatedProjectOrigins(identifiers)
  if (matchingOrigins[0]) {
    return matchingOrigins[0]
  }

  const projects = relatedProjects({ noThrow: true })
  if (projects.length !== 1) {
    return null
  }

  return getProjectOrigin(projects[0])
}
