import type { VercelConfig } from '@vercel/config/v1'

const apiProjectId = process.env.VERCEL_API_PROJECT_ID?.trim()
const webProjectId = process.env.VERCEL_WEB_PROJECT_ID?.trim()
const adminProjectId = process.env.VERCEL_ADMIN_PROJECT_ID?.trim()

if (!(apiProjectId && webProjectId && adminProjectId)) {
  throw new Error('No related projects found')
}

export const config: VercelConfig = {
  relatedProjects: [apiProjectId, webProjectId, adminProjectId],
}
