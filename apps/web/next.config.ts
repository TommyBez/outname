import {
  createOutnameNextConfig,
  wrapOutnameNextConfig,
} from '../../packages/shared/next/create-outname-next-config'

const nextConfig = createOutnameNextConfig({
  role: 'web',
})

export default wrapOutnameNextConfig(nextConfig)
