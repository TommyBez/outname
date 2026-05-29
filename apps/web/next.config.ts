import { join } from 'node:path'
import createMDX from '@next/mdx'
import { withBotId } from 'botid/next/config'
import type { NextConfig } from 'next'
import { withWorkflow } from 'workflow/next'
import {
  getRelatedProjectOrigin,
  VERCEL_API_PROJECT_IDENTIFIERS,
} from '../../packages/shared/vercel-related-projects'

const workspaceRoot = join(process.cwd(), '../..')
const workspacePackages = [
  '@outname/ai',
  '@outname/auth',
  '@outname/db',
  '@outname/email',
  '@outname/shared',
  '@outname/ui',
  '@outname/workflow',
]
const previewApiBaseUrl =
  process.env.VERCEL_ENV === 'preview'
    ? getRelatedProjectOrigin(VERCEL_API_PROJECT_IDENTIFIERS)
    : null

const nextConfig: NextConfig = {
  cacheComponents: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      previewApiBaseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
  },
  outputFileTracingRoot: workspaceRoot,
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
