import { join } from 'node:path'
import createMDX from '@next/mdx'
import { withBotId } from 'botid/next/config'
import type { NextConfig } from 'next'
import { withWorkflow } from 'workflow/next'
import { getRelatedProjectOrigin } from '../../packages/shared/vercel-related-projects'

const workspaceRoot = join(process.cwd(), '../..')
const API_RELATED_PROJECT_NAME = 'outname-api'
const workspacePackages = [
  '@outname/ai',
  '@outname/auth',
  '@outname/db',
  '@outname/email',
  '@outname/shared',
  '@outname/ui',
  '@outname/workflow',
]
const apiRewriteOrigin =
  process.env.VERCEL_ENV === 'preview'
    ? getRelatedProjectOrigin(API_RELATED_PROJECT_NAME)
    : (process.env.NEXT_PUBLIC_API_BASE_URL ?? null)

const nextConfig: NextConfig = {
  cacheComponents: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL: '',
  },
  outputFileTracingRoot: workspaceRoot,
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

export default withWorkflow(withMDX(withBotId(nextConfig)))
