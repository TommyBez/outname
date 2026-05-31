import createMDX from '@next/mdx'
import { withRelatedProject } from '@vercel/related-projects'
import { withBotId } from 'botid/next/config'
import type { NextConfig } from 'next'

const API_RELATED_PROJECT_NAME = 'outname-api'
const workspacePackages = [
  '@outname/ai',
  '@outname/auth',
  '@outname/db',
  '@outname/email',
  '@outname/shared',
  '@outname/ui',
]
const apiRewriteOrigin = withRelatedProject({
  defaultHost: process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
  projectName: API_RELATED_PROJECT_NAME,
})

const nextConfig: NextConfig = {
  cacheComponents: true,
  async rewrites() {
    return apiRewriteOrigin
      ? [
          {
            destination: `${apiRewriteOrigin}/api/:path*`,
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
