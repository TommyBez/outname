import { describe, expect, it, vi } from 'vitest'
import {
  PRODUCT_HUNT_DEFAULT_LAUNCH_URL_CANDIDATES,
  parseProductHuntLaunchUrlCandidates,
  resolveProductHuntLaunchUrl,
} from './product-hunt-url-discovery'

const LIVE_WINDOW = new Date('2026-06-16T07:10:00.000Z')
const PRELAUNCH_WINDOW = new Date('2026-06-15T07:10:00.000Z')

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    headers: { 'content-type': 'text/html' },
    status,
  })
}

describe('Product Hunt launch URL discovery', () => {
  it('uses the configured Product Hunt post URL before probing candidates', async () => {
    const fetcher = vi.fn()

    await expect(
      resolveProductHuntLaunchUrl({
        explicitUrl: 'https://www.producthunt.com/posts/outna-me',
        fetcher,
        now: LIVE_WINDOW,
      })
    ).resolves.toEqual({
      candidates: [],
      source: 'env',
      url: 'https://www.producthunt.com/posts/outna-me',
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('parses configured candidates before the default slug candidates', () => {
    expect(
      parseProductHuntLaunchUrlCandidates(`
        https://www.producthunt.com/posts/custom-outname,
        https://example.com/posts/not-product-hunt
        https://www.producthunt.com/posts/outna-me
      `)
    ).toEqual([
      'https://www.producthunt.com/posts/custom-outname',
      ...PRODUCT_HUNT_DEFAULT_LAUNCH_URL_CANDIDATES,
    ])
  })

  it('does not probe Product Hunt before the launch window opens', async () => {
    const fetcher = vi.fn()

    await expect(
      resolveProductHuntLaunchUrl({
        fetcher,
        now: PRELAUNCH_WINDOW,
      })
    ).resolves.toEqual({
      candidates: [],
      source: 'none',
      url: null,
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('returns the first candidate whose public page contains the product marker', async () => {
    const fetcher = vi.fn(async () =>
      htmlResponse('<html><title>OUTNA.ME on Product Hunt</title></html>')
    )

    await expect(
      resolveProductHuntLaunchUrl({
        candidateUrls: 'https://www.producthunt.com/posts/outna-me',
        fetcher,
        now: LIVE_WINDOW,
      })
    ).resolves.toEqual({
      candidates: [
        {
          ok: true,
          status: 200,
          url: 'https://www.producthunt.com/posts/outna-me',
        },
      ],
      source: 'candidate',
      url: 'https://www.producthunt.com/posts/outna-me',
    })
  })

  it('continues probing when a candidate is reachable but does not match the product', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(htmlResponse('<html>Different product</html>'))
      .mockResolvedValueOnce(htmlResponse('<html>Hosted AI agents</html>'))

    const result = await resolveProductHuntLaunchUrl({
      candidateUrls:
        'https://www.producthunt.com/posts/custom-outname https://www.producthunt.com/posts/outna-me',
      fetcher,
      now: LIVE_WINDOW,
    })

    expect(result).toEqual({
      candidates: [
        {
          ok: false,
          reason: 'product_marker_missing',
          status: 200,
          url: 'https://www.producthunt.com/posts/custom-outname',
        },
        {
          ok: true,
          status: 200,
          url: 'https://www.producthunt.com/posts/outna-me',
        },
      ],
      source: 'candidate',
      url: 'https://www.producthunt.com/posts/outna-me',
    })
  })

  it('reports failed probes without making the cron fail closed', async () => {
    const fetcher = vi.fn(async () => htmlResponse('not found', 404))

    const result = await resolveProductHuntLaunchUrl({
      candidateUrls: 'https://www.producthunt.com/posts/outna-me',
      fetcher,
      now: LIVE_WINDOW,
    })

    expect(result).toEqual({
      candidates: [
        {
          ok: false,
          reason: 'http_error',
          status: 404,
          url: 'https://www.producthunt.com/posts/outna-me',
        },
        {
          ok: false,
          reason: 'http_error',
          status: 404,
          url: 'https://www.producthunt.com/posts/outname',
        },
      ],
      source: 'none',
      url: null,
    })
  })
})
