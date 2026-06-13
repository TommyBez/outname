import { describe, expect, it } from 'vitest'
import {
  getProductHuntSocialSkipReason,
  PRODUCT_HUNT_SOCIAL_POSTS,
  renderProductHuntSocialText,
} from './product-hunt-social'

const LIVE_WINDOW_WITHOUT_URL = new Date('2026-06-16T07:20:00.000Z')
const FALLBACK_WINDOW_WITHOUT_URL = new Date('2026-06-16T08:20:00.000Z')
const FALLBACK_WINDOW_WITH_URL = new Date('2026-06-16T08:20:00.000Z')
const PRODUCT_HUNT_URL = 'https://www.producthunt.com/posts/outna-me'

function getSocialPost(id: string) {
  const post = PRODUCT_HUNT_SOCIAL_POSTS.find((item) => item.id === id)

  if (!post) {
    throw new Error(`Missing social post fixture: ${id}`)
  }

  return post
}

describe('Product Hunt social posts', () => {
  it('does not render an empty Product Hunt URL into URL-dependent posts', () => {
    const post = getSocialPost('2026-06-16-live-now-x')

    expect(
      getProductHuntSocialSkipReason({
        now: LIVE_WINDOW_WITHOUT_URL,
        post,
        productHuntUrl: null,
      })
    ).toBe('product_hunt_url_missing')

    expect(
      renderProductHuntSocialText({
        post,
        productHuntUrl: PRODUCT_HUNT_URL,
      })
    ).toContain(PRODUCT_HUNT_URL)
  })

  it('waits to schedule fallback posts until the fallback window opens', () => {
    const post = getSocialPost('2026-06-16-live-fallback-x')

    expect(
      getProductHuntSocialSkipReason({
        now: LIVE_WINDOW_WITHOUT_URL,
        post,
        productHuntUrl: null,
      })
    ).toBe('schedule_window_not_open')

    expect(
      getProductHuntSocialSkipReason({
        now: FALLBACK_WINDOW_WITHOUT_URL,
        post,
        productHuntUrl: null,
      })
    ).toBeNull()
  })

  it('keeps prelaunch posts available for a delayed Sunday merge but expires them before the Monday reminder', () => {
    const post = getSocialPost('2026-06-13-vercel-day-prelaunch-x')

    expect(
      getProductHuntSocialSkipReason({
        now: new Date('2026-06-14T12:00:00.000Z'),
        post,
        productHuntUrl: null,
      })
    ).toBeNull()

    expect(
      getProductHuntSocialSkipReason({
        now: new Date('2026-06-15T07:01:00.000Z'),
        post,
        productHuntUrl: null,
      })
    ).toBe('post_window_expired')
  })

  it('suppresses fallback posts when the Product Hunt URL is available', () => {
    const post = getSocialPost('2026-06-16-live-fallback-linkedin')

    expect(
      getProductHuntSocialSkipReason({
        now: FALLBACK_WINDOW_WITH_URL,
        post,
        productHuntUrl: PRODUCT_HUNT_URL,
      })
    ).toBe('product_hunt_url_present')
  })

  it('keeps every Product Hunt URL placeholder on URL-dependent posts only', () => {
    for (const post of PRODUCT_HUNT_SOCIAL_POSTS) {
      const hasPlaceholder = post.text.includes('{{PRODUCT_HUNT_URL}}')

      expect(hasPlaceholder).toBe(post.requiresProductHuntUrl)
    }
  })
})
