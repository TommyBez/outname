import { resolve } from 'node:path'
import { Config } from '@remotion/cli/config'
import { enableTailwind } from '@remotion/tailwind-v4'

Config.setPublicDir(resolve(process.cwd(), '../../packages/email/static'))

Config.overrideWebpackConfig((currentConfiguration) => {
  const tailwindConfiguration = enableTailwind(currentConfiguration)

  return {
    ...tailwindConfiguration,
    resolve: {
      ...tailwindConfiguration.resolve,
      alias: {
        ...tailwindConfiguration.resolve?.alias,
        '@outname/ai': resolve(process.cwd(), '../../packages/ai'),
        '@outname/shared': resolve(process.cwd(), '../../packages/shared'),
        '@outname/ui': resolve(process.cwd(), '../../packages/ui'),
      },
    },
  }
})
