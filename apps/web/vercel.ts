import type { VercelConfig } from '@vercel/config/v1'

const apiProjectId = process.env.VERCEL_API_PROJECT_ID?.trim()
const appProjectId = process.env.VERCEL_APP_PROJECT_ID?.trim()
const adminProjectId = process.env.VERCEL_ADMIN_PROJECT_ID?.trim()


if(!(apiProjectId && appProjectId && adminProjectId)) {
  throw new Error('No related projects found')
}

export const config: VercelConfig = {
  relatedProjects: [apiProjectId, appProjectId, adminProjectId]
}
