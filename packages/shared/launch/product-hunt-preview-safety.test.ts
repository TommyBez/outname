import { afterEach, describe, expect, it } from 'vitest'
import {
  areProductHuntLaunchExternalSideEffectsDisabled,
  createProductHuntPreviewExternalSideEffectSkip,
} from './product-hunt-preview-safety'

const ENV_KEYS = ['VERCEL', 'VERCEL_ENV'] as const

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
  it('disables launch external side effects in Vercel preview deployments', () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'preview'

    expect(areProductHuntLaunchExternalSideEffectsDisabled()).toBe(true)
  })

  it('keeps production external side effects enabled', () => {
    process.env.VERCEL = '1'
    process.env.VERCEL_ENV = 'production'

    expect(areProductHuntLaunchExternalSideEffectsDisabled()).toBe(false)
  })

  it('keeps local external side effects enabled', () => {
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV

    expect(areProductHuntLaunchExternalSideEffectsDisabled()).toBe(false)
  })

  it('returns a stable preview skip payload', () => {
    expect(createProductHuntPreviewExternalSideEffectSkip()).toEqual({
      ok: true,
      skipped:
        'product hunt launch external side effects disabled in Vercel preview',
    })
  })
})
