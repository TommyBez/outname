import { afterEach, describe, expect, it } from 'vitest'
import {
  areProductHuntLaunchSideEffectsDisabled,
  createProductHuntPreviewSideEffectSkip,
} from './product-hunt-preview-safety'

const ENV_KEYS = [
  'PRODUCT_HUNT_ALLOW_PREVIEW_SIDE_EFFECTS',
  'VERCEL',
  'VERCEL_ENV',
] as const

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
) as Record<(typeof ENV_KEYS)[number], string | undefined>

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

afterEach(() => {
  restoreEnv()
})

describe('Product Hunt preview safety', () => {
  it('disables launch side effects in Vercel preview deployments', () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'preview'

    expect(areProductHuntLaunchSideEffectsDisabled()).toBe(true)
  })

  it('allows explicit opt-in for preview side effects', () => {
    process.env.PRODUCT_HUNT_ALLOW_PREVIEW_SIDE_EFFECTS = 'true'
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'preview'

    expect(areProductHuntLaunchSideEffectsDisabled()).toBe(false)
  })

  it('keeps production side effects enabled', () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'

    expect(areProductHuntLaunchSideEffectsDisabled()).toBe(false)
  })

  it('keeps local side effects enabled', () => {
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV

    expect(areProductHuntLaunchSideEffectsDisabled()).toBe(false)
  })

  it('returns a stable preview skip payload', () => {
    expect(createProductHuntPreviewSideEffectSkip()).toEqual({
      ok: true,
      skipped: 'product hunt launch side effects disabled in Vercel preview',
    })
  })
})
