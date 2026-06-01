import createMDX from '@next/mdx'
import { withBotId } from 'botid/next/config'
import type { NextConfig } from 'next'
import { LOCAL_PROJECT_ORIGINS } from '../../packages/shared/vercel-related-projects'

const workspacePackages = [
  '@outname/ai',
  '@outname/auth',
  '@outname/db',
  '@outname/email',
  '@outname/shared',
  '@outname/ui',
]

const apiOrigin =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || LOCAL_PROJECT_ORIGINS.api

const nextConfig: NextConfig = {
  cacheComponents: true,
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
