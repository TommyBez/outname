import type { VercelConfig } from '@vercel/config/v1'

const apiProjectId = process.env.VERCEL_API_PROJECT_ID?.trim()
const webProjectId = process.env.VERCEL_WEB_PROJECT_ID?.trim()

if (!(apiProjectId && webProjectId)) {
  throw new Error('No related projects found')
}

console.log('[vercel.ts]apiProjectId', apiProjectId)
console.log('[vercel.ts]webProjectId', webProjectId)

/**
 * This app (and the api + web trio) uses its full allowance of 3 Related Projects
 * to reference the other two apps in the main group + the admin project.
 *
 * Admin itself is excluded from declaring any related projects (see apps/admin/vercel.ts).
 * The admin deployment receives the api/app/web origins via explicit
 * NEXT_PUBLIC_*_URL environment variables set on the admin Vercel project.
 */
export const config: VercelConfig = {
  relatedProjects: [apiProjectId, webProjectId],
}
