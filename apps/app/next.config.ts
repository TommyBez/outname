import createMDX from '@next/mdx'
import { withBotId } from 'botid/next/config'
import type { NextConfig } from 'next'
import {
  getCurrentProjectOrigin,
  getRelatedProjectOriginById,
  LOCAL_PROJECT_ORIGINS,
} from '../../packages/shared/vercel-related-projects'

const workspacePackages = [
  '@outname/ai',
  '@outname/auth',
  '@outname/db',
  '@outname/email',
  '@outname/shared',
  '@outname/ui',
]
const apiOrigin = getRelatedProjectOriginById(
  process.env.VERCEL_API_PROJECT_ID,
  LOCAL_PROJECT_ORIGINS.api
)
const appOrigin = getCurrentProjectOrigin(LOCAL_PROJECT_ORIGINS.app)
const webOrigin = getRelatedProjectOriginById(
  process.env.VERCEL_WEB_PROJECT_ID,
  LOCAL_PROJECT_ORIGINS.web
)

console.log({apiOrigin, appOrigin, webOrigin })

const nextConfig: NextConfig = {
  cacheComponents: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL: apiOrigin,
    NEXT_PUBLIC_APP_URL: appOrigin,
    NEXT_PUBLIC_WEB_URL: webOrigin,
  },
  async redirects() {
    return [
      {
        destination: '/dashboard',
        permanent: false,
        source: '/',
      },
    ]
  },
  async rewrites() {
    return apiOrigin
      ? [
          {
            destination: `${apiOrigin}/api/:path*`,
            source: '/api/:path*',
          },
        ]
      : []
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

export default withMDX(withBotId(nextConfig))
