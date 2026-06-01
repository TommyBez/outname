import type { VercelConfig } from '@vercel/config/v1'

const apiProjectId = process.env.VERCEL_API_PROJECT_ID?.trim()
const webProjectId = process.env.VERCEL_WEB_PROJECT_ID?.trim()
const adminProjectId = process.env.VERCEL_ADMIN_PROJECT_ID?.trim()

const relatedProjects: string[] = []
if (apiProjectId) {
  relatedProjects.push(apiProjectId)
}
if (webProjectId) {
  relatedProjects.push(webProjectId)
}
if (adminProjectId) {
  relatedProjects.push(adminProjectId)
}

export const config: VercelConfig = {
  ...(relatedProjects.length > 0 ? { relatedProjects } : {}),
}
