import { describe, expect, it } from 'vitest'
import {
  getProductHuntEmailEventSkipReason,
  type ProductHuntEmailEvent,
  productHuntEmailEvents,
} from './product-hunt'

const PRODUCT_HUNT_URL = 'https://www.producthunt.com/posts/outna-me'
const BEFORE_REMINDER_WINDOW = new Date('2026-06-15T08:00:00.000Z')
const REMINDER_WINDOW = new Date('2026-06-15T08:45:00.000Z')
const LIVE_WINDOW_BEFORE_FALLBACK = new Date('2026-06-16T07:20:00.000Z')
const LIVE_FALLBACK_WINDOW = new Date('2026-06-16T08:20:00.000Z')
const RECAP_WINDOW_BEFORE_FALLBACK = new Date('2026-06-17T09:00:00.000Z')
const RECAP_FALLBACK_WINDOW = new Date('2026-06-17T10:15:00.000Z')

function getEmailEvent(key: string): ProductHuntEmailEvent {
  const event = productHuntEmailEvents.find((item) => item.key === key)

  if (!event) {
    throw new Error(`Missing Product Hunt email event fixture: ${key}`)
  }

  return event
}

function getSuppressedEventKeys(event: ProductHuntEmailEvent): string[] {
  if ('suppressIfDeliveredEventKeys' in event) {
    return [...event.suppressIfDeliveredEventKeys]
  }
  return []
}

describe('Product Hunt email events', () => {
  it('keeps the reminder independent from the Product Hunt URL', () => {
    const reminder = getEmailEvent('vercel-day-reminder')

    expect(
      getProductHuntEmailEventSkipReason({
        event: reminder,
        now: BEFORE_REMINDER_WINDOW,
        productHuntUrl: null,
      })
    ).toBe('outside_event_window')

    expect(
      getProductHuntEmailEventSkipReason({
        event: reminder,
        now: REMINDER_WINDOW,
        productHuntUrl: null,
      })
    ).toBeNull()
  })

  it('sends launch-day live email only when the Product Hunt URL is available', () => {
    const live = getEmailEvent('vercel-day-live')

    expect(
      getProductHuntEmailEventSkipReason({
        event: live,
        now: LIVE_WINDOW_BEFORE_FALLBACK,
        productHuntUrl: null,
      })
    ).toBe('product_hunt_url_missing')

    expect(
      getProductHuntEmailEventSkipReason({
        event: live,
        now: LIVE_WINDOW_BEFORE_FALLBACK,
        productHuntUrl: PRODUCT_HUNT_URL,
      })
    ).toBeNull()
  })

  it('waits for the launch-day fallback window and suppresses fallback when the Product Hunt URL exists', () => {
    const fallback = getEmailEvent('vercel-day-live-fallback')

    expect(
      getProductHuntEmailEventSkipReason({
        event: fallback,
        now: LIVE_WINDOW_BEFORE_FALLBACK,
        productHuntUrl: null,
      })
    ).toBe('outside_event_window')

    expect(
      getProductHuntEmailEventSkipReason({
        event: fallback,
        now: LIVE_FALLBACK_WINDOW,
        productHuntUrl: null,
      })
    ).toBeNull()

    expect(
      getProductHuntEmailEventSkipReason({
        event: fallback,
        now: LIVE_FALLBACK_WINDOW,
        productHuntUrl: PRODUCT_HUNT_URL,
      })
    ).toBe('product_hunt_url_present')
  })

  it('keeps recap and recap fallback URL behavior mutually exclusive', () => {
    const recap = getEmailEvent('vercel-day-recap')
    const fallback = getEmailEvent('vercel-day-recap-fallback')

    expect(
      getProductHuntEmailEventSkipReason({
        event: recap,
        now: RECAP_WINDOW_BEFORE_FALLBACK,
        productHuntUrl: null,
      })
    ).toBe('product_hunt_url_missing')

    expect(
      getProductHuntEmailEventSkipReason({
        event: recap,
        now: RECAP_WINDOW_BEFORE_FALLBACK,
        productHuntUrl: PRODUCT_HUNT_URL,
      })
    ).toBeNull()

    expect(
      getProductHuntEmailEventSkipReason({
        event: fallback,
        now: RECAP_FALLBACK_WINDOW,
        productHuntUrl: null,
      })
    ).toBeNull()

    expect(
      getProductHuntEmailEventSkipReason({
        event: fallback,
        now: RECAP_FALLBACK_WINDOW,
        productHuntUrl: PRODUCT_HUNT_URL,
      })
    ).toBe('product_hunt_url_present')
  })

  it('marks live and fallback pairs as mutually suppressing per recipient', () => {
    const live = getEmailEvent('vercel-day-live')
    const liveFallback = getEmailEvent('vercel-day-live-fallback')
    const recap = getEmailEvent('vercel-day-recap')
    const recapFallback = getEmailEvent('vercel-day-recap-fallback')

    expect(getSuppressedEventKeys(live)).toContain(liveFallback.key)
    expect(getSuppressedEventKeys(liveFallback)).toContain(live.key)
    expect(getSuppressedEventKeys(recap)).toContain(recapFallback.key)
    expect(getSuppressedEventKeys(recapFallback)).toContain(recap.key)
  })
})
