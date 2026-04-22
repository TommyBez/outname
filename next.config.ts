import { withWorkflow } from "workflow/next"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ["better-auth"],
}

export default withWorkflow(nextConfig)
