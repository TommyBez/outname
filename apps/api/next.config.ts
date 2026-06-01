import createMDX from '@next/mdx'
import {
  getCurrentProjectOrigin,
  getRelatedProjectOriginById,
  LOCAL_PROJECT_ORIGINS,
} from '@outname/shared/vercel-related-projects'
import { withBotId } from 'botid/next/config'
import type { NextConfig } from 'next'
import { withWorkflow } from 'workflow/next'

const workspacePackages = [
  '@outname/ai',
  '@outname/auth',
  '@outname/db',
  '@outname/email',
  '@outname/shared',
  '@outname/ui',
  '@outname/workflow',
]
const apiOrigin =
  process.env.BETTER_AUTH_URL?.trim() ||
  getCurrentProjectOrigin(LOCAL_PROJECT_ORIGINS.api)
const appOrigin = getRelatedProjectOriginById(
  process.env.VERCEL_APP_PROJECT_ID,
  LOCAL_PROJECT_ORIGINS.app
)
const webOrigin = getRelatedProjectOriginById(
  process.env.VERCEL_WEB_PROJECT_ID,
  LOCAL_PROJECT_ORIGINS.web
)
const adminOrigin = getRelatedProjectOriginById(
  process.env.VERCEL_ADMIN_PROJECT_ID,
  LOCAL_PROJECT_ORIGINS.admin
)

const nextConfig: NextConfig = {
  cacheComponents: true,
  env: {
    NEXT_PUBLIC_ADMIN_URL: adminOrigin,
    NEXT_PUBLIC_API_BASE_URL: apiOrigin,
    NEXT_PUBLIC_APP_URL: appOrigin,
    NEXT_PUBLIC_WEB_URL: webOrigin,
  },
  serverExternalPackages: ['better-auth', 'bash-tool', 'just-bash', 'pg'],
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  transpilePackages: workspacePackages,
}

const withMDX = createMDX({
  options: {
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: [],
  },
})

export default withWorkflow(withMDX(withBotId(nextConfig)))
