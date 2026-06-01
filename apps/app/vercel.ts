import type { VercelConfig } from '@vercel/config/v1'

const apiProjectId = process.env.VERCEL_API_PROJECT_ID?.trim()
const webProjectId = process.env.VERCEL_WEB_PROJECT_ID?.trim()

if (!(apiProjectId && webProjectId)) {
  throw new Error('No related projects found')
}

console.log('[vercel.ts]apiProjectId', apiProjectId)
console.log('[vercel.ts]webProjectId', webProjectId)

export const config: VercelConfig = {
  relatedProjects: [apiProjectId, webProjectId],
}
