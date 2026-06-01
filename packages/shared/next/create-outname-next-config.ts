import createMDX from '@next/mdx'
import { withBotId } from 'botid/next/config'
import type { NextConfig } from 'next'
import {
  getCurrentProjectOrigin,
  getRelatedProjectOriginById,
  LOCAL_PROJECT_ORIGINS,
} from '../vercel-related-projects'

export type OutnameAppRole = 'api' | 'app' | 'web'

const BASE_WORKSPACE_PACKAGES = [
  '@outname/ai',
  '@outname/auth',
  '@outname/db',
  '@outname/email',
  '@outname/shared',
  '@outname/ui',
] as const

const SERVER_EXTERNAL_PACKAGES = [
  'better-auth',
  'bash-tool',
  'just-bash',
  'pg',
] as const

export interface CreateOutnameNextConfigInput {
  extraTranspilePackages?: string[]
  redirects?: NextConfig['redirects']
  rewrites?: NextConfig['rewrites']
  role: OutnameAppRole
}

function resolveOrigins(role: OutnameAppRole): {
  apiOrigin: string
  appOrigin: string
  webOrigin: string
} {
  const apiOrigin =
    role === 'api'
      ? process.env.BETTER_AUTH_URL?.trim() ||
        getCurrentProjectOrigin(LOCAL_PROJECT_ORIGINS.api)
      : getRelatedProjectOriginById(
          process.env.VERCEL_API_PROJECT_ID,
          LOCAL_PROJECT_ORIGINS.api
        )

  const appOrigin =
    role === 'app'
      ? getCurrentProjectOrigin(LOCAL_PROJECT_ORIGINS.app)
      : getRelatedProjectOriginById(
          process.env.VERCEL_APP_PROJECT_ID,
          LOCAL_PROJECT_ORIGINS.app
        )

  const webOrigin =
    role === 'web'
      ? getCurrentProjectOrigin(LOCAL_PROJECT_ORIGINS.web)
      : getRelatedProjectOriginById(
          process.env.VERCEL_WEB_PROJECT_ID,
          LOCAL_PROJECT_ORIGINS.web
        )

  return { apiOrigin, appOrigin, webOrigin }
}

function resolveRewritesConfig(
  input: CreateOutnameNextConfigInput,
  apiOrigin: string
): Pick<NextConfig, 'rewrites'> {
  if (input.rewrites !== undefined) {
    return { rewrites: input.rewrites }
  }
  if (input.role === 'api') {
    return {}
  }
  return { rewrites: defaultApiRewrites(apiOrigin) }
}

function defaultApiRewrites(apiOrigin: string): NextConfig['rewrites'] {
  if (!apiOrigin) {
    return
  }

  return async () => [
    {
      destination: `${apiOrigin}/api/:path*`,
      source: '/api/:path*',
    },
  ]
}

export function createOutnameNextConfig(
  input: CreateOutnameNextConfigInput
): NextConfig {
  const { apiOrigin, appOrigin, webOrigin } = resolveOrigins(input.role)
  const transpilePackages = [
    ...BASE_WORKSPACE_PACKAGES,
    ...(input.extraTranspilePackages ?? []),
  ]

  return {
    cacheComponents: true,
    env: {
      NEXT_PUBLIC_API_BASE_URL: apiOrigin,
      NEXT_PUBLIC_APP_URL: appOrigin,
      NEXT_PUBLIC_WEB_URL: webOrigin,
    },
    ...(input.redirects ? { redirects: input.redirects } : {}),
    ...resolveRewritesConfig(input, apiOrigin),
    serverExternalPackages: [...SERVER_EXTERNAL_PACKAGES],
    pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
    transpilePackages: [...transpilePackages],
  }
}

export function wrapOutnameNextConfig(config: NextConfig): NextConfig {
  const withMDX = createMDX({
    options: {
      remarkPlugins: ['remark-gfm'],
      rehypePlugins: [],
    },
  })

  return withMDX(withBotId(config))
}
