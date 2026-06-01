import type { VercelConfig } from '@vercel/config/v1'

const apiProjectId = process.env.VERCEL_API_PROJECT_ID?.trim()
const appProjectId = process.env.VERCEL_APP_PROJECT_ID?.trim()

if (!(apiProjectId && appProjectId)) {
  throw new Error('No related projects found')
}

/**
 * Related projects for cross-app URL resolution in preview/production.
 */
export const config: VercelConfig = {
  relatedProjects: [apiProjectId, appProjectId],
}
