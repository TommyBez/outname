import type { VercelConfig } from '@vercel/config/v1'

const apiProjectId = process.env.VERCEL_API_PROJECT_ID?.trim()
const appProjectId = process.env.VERCEL_APP_PROJECT_ID?.trim()
const webProjectId = process.env.VERCEL_WEB_PROJECT_ID?.trim()

const relatedProjects: string[] = []
if (apiProjectId) {
  relatedProjects.push(apiProjectId)
}
if (appProjectId) {
  relatedProjects.push(appProjectId)
}
if (webProjectId) {
  relatedProjects.push(webProjectId)
}

export const config: VercelConfig = {
  ...(relatedProjects.length > 0 ? { relatedProjects } : {}),
}
