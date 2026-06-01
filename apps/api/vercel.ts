import type { VercelConfig } from '@vercel/config/v1'

const webProjectId = process.env.VERCEL_WEB_PROJECT_ID?.trim()
const appProjectId = process.env.VERCEL_APP_PROJECT_ID?.trim()
const adminProjectId = process.env.VERCEL_ADMIN_PROJECT_ID?.trim()

const relatedProjects: string[] = []
if (webProjectId) {
  relatedProjects.push(webProjectId)
}
if (appProjectId) {
  relatedProjects.push(appProjectId)
}
if (adminProjectId) {
  relatedProjects.push(adminProjectId)
}

export const config: VercelConfig = {
  crons: [
    {
      path: '/api/cron/liveness',
      schedule: '*/5 * * * *',
    },
  ],
  ...(relatedProjects.length > 0 ? { relatedProjects } : {}),
}
