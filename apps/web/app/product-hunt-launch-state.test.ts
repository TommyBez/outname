import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStaticProductHuntLaunchState } from './product-hunt-launch-state'

vi.mock('server-only', () => ({}))

const ENV_KEYS = [
  'NEXT_PUBLIC_PRODUCT_HUNT_LAUNCH_URL',
  'PRODUCT_HUNT_LAUNCH_URL',
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

describe('Product Hunt launch state', () => {
  it('keeps the static fallback in prelaunch copy before dynamic resolution', () => {
    delete process.env.NEXT_PUBLIC_PRODUCT_HUNT_LAUNCH_URL
    delete process.env.PRODUCT_HUNT_LAUNCH_URL

    expect(createStaticProductHuntLaunchState()).toEqual({
      launchUrl: null,
      phase: 'prelaunch',
    })
  })

  it('keeps static fallback copy prelaunch even when the launch URL is configured', () => {
    process.env.NEXT_PUBLIC_PRODUCT_HUNT_LAUNCH_URL =
      'https://www.producthunt.com/posts/outna-me'

    expect(createStaticProductHuntLaunchState()).toEqual({
      launchUrl: 'https://www.producthunt.com/posts/outna-me',
      phase: 'prelaunch',
    })
  })
})
