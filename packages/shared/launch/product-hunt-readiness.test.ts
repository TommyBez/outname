import { describe, expect, it } from 'vitest'
import {
  getProductHuntLaunchReadiness,
  type ProductHuntLaunchReadiness,
} from './product-hunt-readiness'

function getCheck(result: ProductHuntLaunchReadiness, key: string) {
  const check = result.checks.find((item) => item.key === key)
  if (!check) {
    throw new Error(`Missing readiness check: ${key}`)
  }
  return check
}

describe('Product Hunt launch readiness', () => {
  it('marks preview as ready without requiring delivery secrets', () => {
    const result = getProductHuntLaunchReadiness({
      VERCEL: '1',
      VERCEL_ENV: 'preview',
    })

    expect(result.ok).toBe(true)
    expect(getCheck(result, 'preview_external_side_effects')).toMatchObject({
      status: 'ready',
    })
    expect(getCheck(result, 'cron_secret')).toMatchObject({
      status: 'ready',
    })
    expect(getCheck(result, 'email_delivery')).toMatchObject({
      message: 'Preview skips Resend and waitlist email delivery.',
      status: 'ready',
    })
    expect(getCheck(result, 'typefully_delivery')).toMatchObject({
      message: 'Preview skips Typefully connection lookup and API calls.',
      status: 'ready',
    })
  })

  it('blocks non-preview runs without cron and email delivery env', () => {
    const result = getProductHuntLaunchReadiness({
      VERCEL: '1',
      VERCEL_ENV: 'production',
    })

    expect(result.ok).toBe(false)
    expect(getCheck(result, 'cron_secret')).toMatchObject({
      status: 'blocked',
    })
    expect(getCheck(result, 'email_delivery')).toMatchObject({
      message:
        'Missing email env for launch delivery: RESEND_API_KEY, WAITLIST_FROM_EMAIL, WAITLIST_REPLY_TO.',
      status: 'blocked',
    })
  })

  it('warns when social automation is disabled outside preview', () => {
    const result = getProductHuntLaunchReadiness({
      CRON_SECRET: 'secret',
      PRODUCT_HUNT_SOCIAL_AUTOMATION_ENABLED: 'false',
      RESEND_API_KEY: 're_test',
      VERCEL: '1',
      VERCEL_ENV: 'production',
      WAITLIST_FROM_EMAIL: 'OUTNA.ME <waitlist@example.com>',
      WAITLIST_REPLY_TO: 'reply@example.com',
    })

    expect(result.ok).toBe(true)
    expect(getCheck(result, 'typefully_delivery')).toMatchObject({
      status: 'warning',
    })
  })

  it('warns about invalid Product Hunt URLs and clamped batch sizes', () => {
    const result = getProductHuntLaunchReadiness({
      CRON_SECRET: 'secret',
      PRODUCT_HUNT_LAUNCH_EMAIL_BATCH_SIZE: '500',
      PRODUCT_HUNT_LAUNCH_URL: 'https://example.com/not-product-hunt',
      RESEND_API_KEY: 're_test',
      VERCEL: '1',
      VERCEL_ENV: 'production',
      WAITLIST_FROM_EMAIL: 'OUTNA.ME <waitlist@example.com>',
      WAITLIST_REPLY_TO: 'reply@example.com',
    })

    expect(result.ok).toBe(true)
    expect(getCheck(result, 'product_hunt_url')).toMatchObject({
      status: 'warning',
    })
    expect(getCheck(result, 'email_batch_size')).toMatchObject({
      message:
        'Email batch size env is invalid or clamped; runtime will use 200.',
      status: 'warning',
    })
  })

  it('marks explicit Product Hunt and Typefully routing env as ready', () => {
    const result = getProductHuntLaunchReadiness({
      CRON_SECRET: 'secret',
      PRODUCT_HUNT_LAUNCH_URL: 'https://www.producthunt.com/posts/outna-me',
      PRODUCT_HUNT_TYPEFULLY_SOCIAL_SET_ID: '123',
      PRODUCT_HUNT_TYPEFULLY_USER_ID: 'user_123',
      RESEND_API_KEY: 're_test',
      VERCEL: '1',
      VERCEL_ENV: 'production',
      WAITLIST_FROM_EMAIL: 'OUTNA.ME <waitlist@example.com>',
      WAITLIST_REPLY_TO: 'reply@example.com',
    })

    expect(result.ok).toBe(true)
    expect(getCheck(result, 'product_hunt_url')).toMatchObject({
      status: 'ready',
    })
    expect(getCheck(result, 'typefully_delivery')).toMatchObject({
      status: 'ready',
    })
  })
})
