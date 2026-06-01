import createMDX from '@next/mdx'
import { withBotId } from 'botid/next/config'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ['better-auth', 'bash-tool', 'just-bash', 'pg'],
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
}

const withMDX = createMDX({
  options: {
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: [],
  },
})

export default withMDX(withBotId(nextConfig))
