import type { NextConfig } from 'next'
import { withWorkflow } from 'workflow/next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ['better-auth'],
}

export default withWorkflow(nextConfig)
