import {
  relatedProjects,
  type VercelRelatedProject,
} from '@vercel/related-projects'

const HOST_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?$/i
const HTTP_URL_PATTERN = /^https?:\/\//i

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

function projectMatchesName(
  project: VercelRelatedProject,
  projectName: string
): boolean {
  return project.project.name === projectName
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
  projectNames?: readonly string[]
): string[] {
  const projects = relatedProjects({ noThrow: true })
  const matchingProjects = projectNames
    ? projects.filter((project) =>
        projectNames.some((projectName) =>
          projectMatchesName(project, projectName)
        )
      )
    : projects

  return unique(
    matchingProjects
      .map((project) => getProjectOrigin(project))
      .filter((origin): origin is string => Boolean(origin))
  )
}
