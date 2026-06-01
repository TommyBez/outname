import { withWorkflow } from 'workflow/next'
import {
  createOutnameNextConfig,
  wrapOutnameNextConfig,
} from '../../packages/shared/next/create-outname-next-config'

const nextConfig = createOutnameNextConfig({
  role: 'api',
  extraTranspilePackages: ['@outname/workflow'],
})

export default withWorkflow(wrapOutnameNextConfig(nextConfig))
