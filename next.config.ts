import createMDX from '@next/mdx'
import { withBotId } from 'botid/next/config'
import type { NextConfig } from 'next'
import { withWorkflow } from 'workflow/next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ['better-auth', 'bash-tool', 'just-bash'],
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
}

const withMDX = createMDX({
  options: {
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: [],
  },
})

export default withWorkflow(withMDX(withBotId(nextConfig)))
