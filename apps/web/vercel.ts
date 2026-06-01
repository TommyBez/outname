import type { VercelConfig } from '@vercel/config/v1'

const apiProjectId = process.env.VERCEL_API_PROJECT_ID?.trim()
const appProjectId = process.env.VERCEL_APP_PROJECT_ID?.trim()

if (!(apiProjectId && appProjectId)) {
  throw new Error('No related projects found')
}

/**
 * This app (and the api + web trio) uses its full allowance of 3 Related Projects
 * to reference the other two apps in the main group + the admin project.
 *
 * Admin itself is excluded from declaring any related projects (see apps/admin/vercel.ts).
 * The admin deployment receives the api/app/web origins via explicit
 * NEXT_PUBLIC_*_URL environment variables set on the admin Vercel project.
 */
export const config: VercelConfig = {
  relatedProjects: [apiProjectId, appProjectId],
}
