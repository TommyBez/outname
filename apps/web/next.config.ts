import { join } from 'node:path'
import createMDX from '@next/mdx'
import { withBotId } from 'botid/next/config'
import type { NextConfig } from 'next'
import { withWorkflow } from 'workflow/next'

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

const nextConfig: NextConfig = {
  cacheComponents: true,
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
