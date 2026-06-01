import type { VercelConfig } from '@vercel/config/v1'

const webProjectId = process.env.VERCEL_WEB_PROJECT_ID?.trim()
const appProjectId = process.env.VERCEL_APP_PROJECT_ID?.trim()

if (!(webProjectId && appProjectId)) {
  throw new Error('No related projects found')
}

export const config: VercelConfig = {
  crons: [
    {
      path: '/api/cron/liveness',
      schedule: '*/5 * * * *',
    },
  ],
  relatedProjects: [webProjectId, appProjectId],
}
