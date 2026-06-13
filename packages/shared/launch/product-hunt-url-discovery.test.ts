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
      htmlResponse(
        '<html><title>OUTNA.ME on Product Hunt</title><p>Hosted AI agents that keep working.</p></html>'
      )
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
        ...PRODUCT_HUNT_DEFAULT_LAUNCH_URL_CANDIDATES.slice(1).map((url) => ({
          ok: true,
          status: 200,
          url,
        })),
      ],
      source: 'candidate',
      url: 'https://www.producthunt.com/posts/outna-me',
    })
  })

  it('continues probing when a candidate is reachable but does not match the product', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(htmlResponse('<html>Different product</html>'))
      .mockResolvedValueOnce(
        htmlResponse('<html>OUTNA.ME hosted AI agents</html>')
      )
      .mockImplementation(async () =>
        htmlResponse('<html>Different product</html>')
      )

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
        ...PRODUCT_HUNT_DEFAULT_LAUNCH_URL_CANDIDATES.filter(
          (url) => url !== 'https://www.producthunt.com/posts/outna-me'
        ).map((url) => ({
          ok: false,
          reason: 'product_marker_missing',
          status: 200,
          url,
        })),
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
      candidates: PRODUCT_HUNT_DEFAULT_LAUNCH_URL_CANDIDATES.map((url) => ({
        ok: false,
        reason: 'http_error',
        status: 404,
        url,
      })),
      source: 'none',
      url: null,
    })
  })

  it('rejects pages that only contain a generic product or context marker', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(htmlResponse('<html>OUTNA.ME only</html>'))
      .mockImplementation(async () =>
        htmlResponse('<html>Hosted AI agents only</html>')
      )

    const result = await resolveProductHuntLaunchUrl({
      candidateUrls: 'https://www.producthunt.com/posts/outna-me',
      fetcher,
      now: LIVE_WINDOW,
    })

    expect(result.source).toBe('none')
    expect(result.url).toBeNull()
    expect(result.candidates.every((candidate) => !candidate.ok)).toBe(true)
  })
})
