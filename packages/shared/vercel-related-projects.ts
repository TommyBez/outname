const HOST_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?$/i
const HTTP_URL_PATTERN = /^https?:\/\//i
const RELATED_PROJECT_ARRAY_KEYS = ['projects', 'relatedProjects'] as const
const RELATED_PROJECT_IDENTIFIER_KEYS = [
  'id',
  'name',
  'projectId',
  'projectName',
  'slug',
] as const

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

interface RelatedProjectEntry {
  key?: string
  value: unknown
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function parseRelatedProjectEntries(
  raw = process.env.VERCEL_RELATED_PROJECTS
): RelatedProjectEntry[] {
  if (!raw) {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (Array.isArray(parsed)) {
    return parsed.map((value) => ({ value }))
  }

  if (!parsed || typeof parsed !== 'object') {
    return []
  }

  for (const key of RELATED_PROJECT_ARRAY_KEYS) {
    const value = (parsed as Record<string, unknown>)[key]
    if (Array.isArray(value)) {
      return value.map((entry) => ({ value: entry }))
    }
  }

  return Object.entries(parsed).map(([key, value]) => ({ key, value }))
}

function toOrigin(value: string): string | null {
  const trimmed = value.trim()
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

function collectOrigins(value: unknown): string[] {
  if (typeof value === 'string') {
    const origin = toOrigin(value)
    return origin ? [origin] : []
  }

  if (Array.isArray(value)) {
    return unique(value.flatMap((entry) => collectOrigins(entry)))
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  return unique(
    Object.values(value as Record<string, unknown>).flatMap((entry) =>
      collectOrigins(entry)
    )
  )
}

function entryMatchesIdentifiers(
  entry: RelatedProjectEntry,
  identifiers: readonly string[]
): boolean {
  if (entry.key && identifiers.includes(entry.key)) {
    return true
  }

  if (!entry.value || typeof entry.value !== 'object') {
    return false
  }

  const project = entry.value as Record<string, unknown>
  return RELATED_PROJECT_IDENTIFIER_KEYS.some((key) => {
    const value = project[key]
    return typeof value === 'string' && identifiers.includes(value)
  })
}

export function getRelatedProjectOrigins(
  identifiers?: readonly string[]
): string[] {
  const entries = parseRelatedProjectEntries()
  const matchingEntries = identifiers
    ? entries.filter((entry) => entryMatchesIdentifiers(entry, identifiers))
    : entries

  return unique(matchingEntries.flatMap((entry) => collectOrigins(entry.value)))
}

export function getRelatedProjectOrigin(
  identifiers: readonly string[]
): string | null {
  const matchingOrigins = getRelatedProjectOrigins(identifiers)
  if (matchingOrigins[0]) {
    return matchingOrigins[0]
  }

  const allEntries = parseRelatedProjectEntries()
  if (allEntries.length !== 1) {
    return null
  }

  return collectOrigins(allEntries[0].value)[0] ?? null
}
