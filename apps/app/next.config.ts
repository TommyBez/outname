import {
  createOutnameNextConfig,
  wrapOutnameNextConfig,
} from '../../packages/shared/next/create-outname-next-config'

const nextConfig = createOutnameNextConfig({
  role: 'app',
  redirects: async () => [
    {
      destination: '/dashboard',
      permanent: false,
      source: '/',
    },
  ],
})

export default wrapOutnameNextConfig(nextConfig)
