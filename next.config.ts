import type { NextConfig } from 'next'
import { withWorkflow } from 'workflow/next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ['better-auth', 'bash-tool', 'just-bash'],
}

export default withWorkflow(nextConfig)
