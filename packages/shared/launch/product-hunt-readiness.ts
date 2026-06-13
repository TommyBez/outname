import {
  normalizeProductHuntLaunchUrl,
  parseProductHuntBatchSize,
} from './product-hunt'
import { areProductHuntLaunchExternalSideEffectsDisabled } from './product-hunt-preview-safety'

type EnvLike = Record<string, string | undefined>

export type ProductHuntLaunchReadinessStatus = 'blocked' | 'ready' | 'warning'

export interface ProductHuntLaunchReadinessCheck {
  key: string
  message: string
  status: ProductHuntLaunchReadinessStatus
}

export interface ProductHuntLaunchReadiness {
  checks: ProductHuntLaunchReadinessCheck[]
  ok: boolean
}

const PRODUCT_HUNT_CANDIDATE_SEPARATOR = /[\s,]+/
const PRODUCT_HUNT_HOST = 'www.producthunt.com'

function getEnvValue(env: EnvLike, key: string): string | null {
  const value = env[key]?.trim()
  return value ? value : null
}

function isExplicitlyFalse(env: EnvLike, key: string): boolean {
  return getEnvValue(env, key) === 'false'
}

function isProductHuntPostUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === PRODUCT_HUNT_HOST &&
      url.pathname.startsWith('/posts/') &&
      url.pathname !== '/posts/new'
    )
  } catch {
    return false
  }
}

function getConfiguredProductHuntPostUrl(env: EnvLike): string | null {
  const explicitUrl = normalizeProductHuntLaunchUrl(
    getEnvValue(env, 'PRODUCT_HUNT_LAUNCH_URL')
  )
  const publicUrl = normalizeProductHuntLaunchUrl(
    getEnvValue(env, 'NEXT_PUBLIC_PRODUCT_HUNT_LAUNCH_URL')
  )
  const configuredUrl = explicitUrl ?? publicUrl

  if (!(configuredUrl && isProductHuntPostUrl(configuredUrl))) {
    return null
  }
  return configuredUrl
}

function hasInvalidConfiguredProductHuntUrl(env: EnvLike): boolean {
  const values = [
    getEnvValue(env, 'PRODUCT_HUNT_LAUNCH_URL'),
    getEnvValue(env, 'NEXT_PUBLIC_PRODUCT_HUNT_LAUNCH_URL'),
  ].filter((value): value is string => Boolean(value))

  return values.some((value) => {
    const normalized = normalizeProductHuntLaunchUrl(value)
    return !(normalized && isProductHuntPostUrl(normalized))
  })
}

function hasConfiguredProductHuntCandidate(env: EnvLike): boolean {
  return (
    getEnvValue(env, 'PRODUCT_HUNT_LAUNCH_URL_CANDIDATES')
      ?.split(PRODUCT_HUNT_CANDIDATE_SEPARATOR)
      .some((candidate) => isProductHuntPostUrl(candidate.trim())) ?? false
  )
}

function createEnvironmentCheck(
  previewSideEffectsDisabled: boolean
): ProductHuntLaunchReadinessCheck {
  if (previewSideEffectsDisabled) {
    return {
      key: 'preview_external_side_effects',
      message:
        'Vercel preview cron exits before Redis, URL discovery, Resend, Typefully, admin notifications, and admin digest delivery.',
      status: 'ready',
    }
  }

  return {
    key: 'preview_external_side_effects',
    message:
      'Non-preview cron may run external launch side effects after cron authentication.',
    status: 'ready',
  }
}

function createCronSecretCheck(
  env: EnvLike,
  previewSideEffectsDisabled: boolean
): ProductHuntLaunchReadinessCheck {
  if (previewSideEffectsDisabled) {
    return {
      key: 'cron_secret',
      message: 'Skipped in preview because the cron exits before auth.',
      status: 'ready',
    }
  }

  if (!getEnvValue(env, 'CRON_SECRET')) {
    return {
      key: 'cron_secret',
      message: 'CRON_SECRET is required outside preview.',
      status: 'blocked',
    }
  }

  return {
    key: 'cron_secret',
    message: 'CRON_SECRET is configured.',
    status: 'ready',
  }
}

function createLaunchAutomationCheck(
  env: EnvLike,
  previewSideEffectsDisabled: boolean
): ProductHuntLaunchReadinessCheck {
  if (previewSideEffectsDisabled) {
    return {
      key: 'launch_automation',
      message:
        'Preview disables launch automation before email or social delivery can start.',
      status: 'ready',
    }
  }

  if (isExplicitlyFalse(env, 'PRODUCT_HUNT_LAUNCH_AUTOMATION_ENABLED')) {
    return {
      key: 'launch_automation',
      message:
        'PRODUCT_HUNT_LAUNCH_AUTOMATION_ENABLED=false prevents the launch cron from running.',
      status: 'blocked',
    }
  }

  return {
    key: 'launch_automation',
    message: 'Launch automation is enabled.',
    status: 'ready',
  }
}

function createEmailDeliveryCheck(
  env: EnvLike,
  previewSideEffectsDisabled: boolean
): ProductHuntLaunchReadinessCheck {
  if (previewSideEffectsDisabled) {
    return {
      key: 'email_delivery',
      message: 'Preview skips Resend and waitlist email delivery.',
      status: 'ready',
    }
  }

  const missingKeys = [
    'RESEND_API_KEY',
    'WAITLIST_FROM_EMAIL',
    'WAITLIST_REPLY_TO',
  ].filter((key) => !getEnvValue(env, key))

  if (missingKeys.length > 0) {
    return {
      key: 'email_delivery',
      message: `Missing email env for launch delivery: ${missingKeys.join(', ')}.`,
      status: 'blocked',
    }
  }

  return {
    key: 'email_delivery',
    message: 'Resend and waitlist sender env are configured.',
    status: 'ready',
  }
}

function createAdminNotificationsCheck(
  previewSideEffectsDisabled: boolean
): ProductHuntLaunchReadinessCheck {
  if (previewSideEffectsDisabled) {
    return {
      key: 'admin_notifications',
      message: 'Preview skips Product Hunt admin issue notifications.',
      status: 'ready',
    }
  }

  return {
    key: 'admin_notifications',
    message:
      'Launch issue, feedback, and digest admin notifications are sent to all users with role admin.',
    status: 'ready',
  }
}

function createTypefullyDeliveryCheck(
  env: EnvLike,
  previewSideEffectsDisabled: boolean
): ProductHuntLaunchReadinessCheck {
  if (previewSideEffectsDisabled) {
    return {
      key: 'typefully_delivery',
      message: 'Preview skips Typefully connection lookup and API calls.',
      status: 'ready',
    }
  }

  if (isExplicitlyFalse(env, 'PRODUCT_HUNT_SOCIAL_AUTOMATION_ENABLED')) {
    return {
      key: 'typefully_delivery',
      message:
        'PRODUCT_HUNT_SOCIAL_AUTOMATION_ENABLED=false disables Typefully social automation.',
      status: 'warning',
    }
  }

  if (
    getEnvValue(env, 'PRODUCT_HUNT_TYPEFULLY_API_KEY') &&
    getEnvValue(env, 'PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID')
  ) {
    return {
      key: 'typefully_delivery',
      message: 'Typefully API key and social set routing env are configured.',
      status: 'ready',
    }
  }

  if (getEnvValue(env, 'PRODUCT_HUNT_TYPEFULLY_API_KEY')) {
    return {
      key: 'typefully_delivery',
      message:
        'Typefully API key is configured. PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID is strongly recommended; without it, automation only proceeds if the API key exposes exactly one social set.',
      status: 'warning',
    }
  }

  if (
    getEnvValue(env, 'PRODUCT_HUNT_TYPEFULLY_USER_ID') &&
    getEnvValue(env, 'PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID')
  ) {
    return {
      key: 'typefully_delivery',
      message:
        'Typefully stored connection user and social set routing env are configured.',
      status: 'ready',
    }
  }

  if (getEnvValue(env, 'PRODUCT_HUNT_TYPEFULLY_USER_ID')) {
    return {
      key: 'typefully_delivery',
      message:
        'Typefully stored connection user is configured, but PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID is required to avoid publishing to the wrong social set.',
      status: 'blocked',
    }
  }

  return {
    key: 'typefully_delivery',
    message:
      'Missing explicit Typefully configuration. Set PRODUCT_HUNT_TYPEFULLY_API_KEY, or set PRODUCT_HUNT_TYPEFULLY_USER_ID with PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID. The cron will not fall back to the first stored Typefully account.',
    status: 'blocked',
  }
}

function createProductHuntUrlCheck(
  env: EnvLike
): ProductHuntLaunchReadinessCheck {
  if (getConfiguredProductHuntPostUrl(env)) {
    return {
      key: 'product_hunt_url',
      message: 'A Product Hunt post URL is configured.',
      status: 'ready',
    }
  }

  if (hasInvalidConfiguredProductHuntUrl(env)) {
    return {
      key: 'product_hunt_url',
      message:
        'Configured Product Hunt URL env is not a valid https://www.producthunt.com/posts/... URL.',
      status: 'warning',
    }
  }

  return {
    key: 'product_hunt_url',
    message:
      'No final Product Hunt post URL is configured yet; live events will rely on candidate discovery or fallback copy.',
    status: 'warning',
  }
}

function createCandidateUrlCheck(
  env: EnvLike
): ProductHuntLaunchReadinessCheck {
  if (getEnvValue(env, 'PRODUCT_HUNT_LAUNCH_URL_CANDIDATES')) {
    if (hasConfiguredProductHuntCandidate(env)) {
      return {
        key: 'product_hunt_url_candidates',
        message:
          'Configured Product Hunt candidate post URLs include a valid post URL.',
        status: 'ready',
      }
    }

    return {
      key: 'product_hunt_url_candidates',
      message:
        'Configured candidate URLs are invalid; built-in Product Hunt slug candidates still remain available.',
      status: 'warning',
    }
  }

  return {
    key: 'product_hunt_url_candidates',
    message: 'Using built-in Product Hunt slug candidates.',
    status: 'ready',
  }
}

function createBatchSizeCheck(env: EnvLike): ProductHuntLaunchReadinessCheck {
  const rawBatchSize = getEnvValue(env, 'PRODUCT_HUNT_LAUNCH_EMAIL_BATCH_SIZE')
  const parsedBatchSize = parseProductHuntBatchSize(rawBatchSize ?? undefined)

  if (rawBatchSize) {
    const configuredBatchSize = Number.parseInt(rawBatchSize, 10)
    if (
      !Number.isFinite(configuredBatchSize) ||
      configuredBatchSize <= 0 ||
      configuredBatchSize !== parsedBatchSize
    ) {
      return {
        key: 'email_batch_size',
        message: `Email batch size env is invalid or clamped; runtime will use ${parsedBatchSize}.`,
        status: 'warning',
      }
    }
  }

  return {
    key: 'email_batch_size',
    message: `Email batch size is ${parsedBatchSize}.`,
    status: 'ready',
  }
}

function createSocialMediaAssetsCheck(
  env: EnvLike,
  previewSideEffectsDisabled: boolean
): ProductHuntLaunchReadinessCheck {
  if (previewSideEffectsDisabled) {
    return {
      key: 'social_media_assets',
      message: 'Preview does not upload social media assets to Typefully.',
      status: 'ready',
    }
  }

  if (isExplicitlyFalse(env, 'PRODUCT_HUNT_SOCIAL_ATTACH_MEDIA')) {
    return {
      key: 'social_media_assets',
      message:
        'PRODUCT_HUNT_SOCIAL_ATTACH_MEDIA=false leaves Typefully posts without launch images.',
      status: 'warning',
    }
  }

  return {
    key: 'social_media_assets',
    message: 'Typefully social media uploads are enabled.',
    status: 'ready',
  }
}

export function getProductHuntLaunchReadiness(
  env: EnvLike = process.env
): ProductHuntLaunchReadiness {
  const previewSideEffectsDisabled =
    areProductHuntLaunchExternalSideEffectsDisabled(env)
  const checks = [
    createEnvironmentCheck(previewSideEffectsDisabled),
    createCronSecretCheck(env, previewSideEffectsDisabled),
    createLaunchAutomationCheck(env, previewSideEffectsDisabled),
    createEmailDeliveryCheck(env, previewSideEffectsDisabled),
    createAdminNotificationsCheck(previewSideEffectsDisabled),
    createTypefullyDeliveryCheck(env, previewSideEffectsDisabled),
    createProductHuntUrlCheck(env),
    createCandidateUrlCheck(env),
    createBatchSizeCheck(env),
    createSocialMediaAssetsCheck(env, previewSideEffectsDisabled),
  ]

  return {
    checks,
    ok: checks.every((check) => check.status !== 'blocked'),
  }
}
