import {
  getProductHuntLaunchPhase,
  normalizeProductHuntLaunchUrl,
} from './product-hunt'

const PRODUCT_HUNT_HOST = 'www.producthunt.com'
const PRODUCT_HUNT_DISCOVERY_TIMEOUT_MS = 3500
const PRODUCT_HUNT_DISCOVERY_BODY_LIMIT = 128 * 1024
const PRODUCT_HUNT_DISCOVERY_CACHE_TTL_MS = 2 * 60 * 1000
const PRODUCT_HUNT_CONTEXT_MARKERS = [
  'ai agents that keep working',
  'hosted ai agents',
  'personal ai agents',
  'vercel day',
  'vercel sandbox',
]
const PRODUCT_HUNT_IDENTITY_MARKERS = ['outna.me', 'outna me', 'outname']
const PRODUCT_HUNT_CANDIDATE_SEPARATOR = /[\s,]+/

export const PRODUCT_HUNT_DEFAULT_LAUNCH_URL_CANDIDATES = [
  'https://www.producthunt.com/posts/outna-me',
  'https://www.producthunt.com/posts/outna-me-2',
  'https://www.producthunt.com/posts/outname',
  'https://www.producthunt.com/posts/outname-2',
  'https://www.producthunt.com/posts/outna-me-vercel-day',
  'https://www.producthunt.com/posts/outname-vercel-day',
] as const

type ProductHuntFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>

export type ProductHuntLaunchUrlSource = 'candidate' | 'env' | 'none'

export interface ProductHuntLaunchUrlProbe {
  ok: boolean
  reason?: string
  status?: number
  url: string
}

export interface ProductHuntLaunchUrlResolution {
  candidates: ProductHuntLaunchUrlProbe[]
  source: ProductHuntLaunchUrlSource
  url: string | null
}

interface CachedProductHuntLaunchUrlResolution {
  expiresAt: number
  key: string
  resolution: ProductHuntLaunchUrlResolution
}

let cachedResolution: CachedProductHuntLaunchUrlResolution | null = null

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

function normalizeProductHuntPostUrl(value?: string | null): string | null {
  const normalized = normalizeProductHuntLaunchUrl(value)
  if (!(normalized && isProductHuntPostUrl(normalized))) {
    return null
  }
  return normalized
}

export function parseProductHuntLaunchUrlCandidates(
  value?: string | null
): string[] {
  const configuredCandidates =
    value
      ?.split(PRODUCT_HUNT_CANDIDATE_SEPARATOR)
      .map((candidate) => normalizeProductHuntPostUrl(candidate))
      .filter((candidate): candidate is string => Boolean(candidate)) ?? []

  return [
    ...new Set([
      ...configuredCandidates,
      ...PRODUCT_HUNT_DEFAULT_LAUNCH_URL_CANDIDATES,
    ]),
  ]
}

function includesAnyMarker(body: string, markers: readonly string[]): boolean {
  return markers.some((marker) => body.includes(marker))
}

function hasProductHuntLaunchMarkers(body: string): boolean {
  return (
    includesAnyMarker(body, PRODUCT_HUNT_IDENTITY_MARKERS) &&
    includesAnyMarker(body, PRODUCT_HUNT_CONTEXT_MARKERS)
  )
}

async function readResponsePrefix(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) {
    return await response.text()
  }

  const decoder = new TextDecoder()
  let body = ''
  let size = 0

  while (size < PRODUCT_HUNT_DISCOVERY_BODY_LIMIT) {
    const result = await reader.read()
    if (result.done) {
      break
    }
    body += decoder.decode(result.value, { stream: true })
    size += result.value.byteLength
  }

  await reader.cancel().catch(() => undefined)
  return body + decoder.decode()
}

async function probeProductHuntLaunchUrl(input: {
  fetcher: ProductHuntFetch
  timeoutMs: number
  url: string
}): Promise<ProductHuntLaunchUrlProbe> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs)

  try {
    const response = await input.fetcher(input.url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent':
          'OUTNA.ME launch automation (+https://outna.me/product-hunt)',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    const finalUrl = normalizeProductHuntPostUrl(response.url) ?? input.url

    if (!response.ok) {
      return {
        ok: false,
        reason: 'http_error',
        status: response.status,
        url: finalUrl,
      }
    }

    const body = (await readResponsePrefix(response)).toLowerCase()
    const hasProductMarker = hasProductHuntLaunchMarkers(body)

    if (!hasProductMarker) {
      return {
        ok: false,
        reason: 'product_marker_missing',
        status: response.status,
        url: finalUrl,
      }
    }

    return { ok: true, status: response.status, url: finalUrl }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.name : 'fetch_failed',
      url: input.url,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function probeProductHuntLaunchUrlCandidates(input: {
  candidateUrls?: string | null
  fetcher: ProductHuntFetch
  timeoutMs: number
}): Promise<ProductHuntLaunchUrlResolution> {
  const candidates = await Promise.all(
    parseProductHuntLaunchUrlCandidates(input.candidateUrls).map(
      async (candidate) =>
        await probeProductHuntLaunchUrl({
          fetcher: input.fetcher,
          timeoutMs: input.timeoutMs,
          url: candidate,
        })
    )
  )
  const match = candidates.find((candidate) => candidate.ok)

  return {
    candidates,
    source: match ? 'candidate' : 'none',
    url: match?.url ?? null,
  }
}

function createCacheKey(input: {
  candidateUrls?: string | null
  timeoutMs: number
}): string {
  return JSON.stringify({
    candidateUrls: parseProductHuntLaunchUrlCandidates(input.candidateUrls),
    timeoutMs: input.timeoutMs,
  })
}

export async function resolveProductHuntLaunchUrl(input: {
  candidateUrls?: string | null
  explicitUrl?: string | null
  fetcher?: ProductHuntFetch
  now?: Date
  publicUrl?: string | null
  timeoutMs?: number
}): Promise<ProductHuntLaunchUrlResolution> {
  const configuredUrl =
    normalizeProductHuntPostUrl(input.explicitUrl) ??
    normalizeProductHuntPostUrl(input.publicUrl)

  if (configuredUrl) {
    return { candidates: [], source: 'env', url: configuredUrl }
  }

  const now = input.now ?? new Date()
  if (getProductHuntLaunchPhase(now) === 'prelaunch') {
    return { candidates: [], source: 'none', url: null }
  }

  const fetcher = input.fetcher ?? fetch
  const timeoutMs = input.timeoutMs ?? PRODUCT_HUNT_DISCOVERY_TIMEOUT_MS

  if (input.fetcher || input.now) {
    return await probeProductHuntLaunchUrlCandidates({
      candidateUrls: input.candidateUrls,
      fetcher,
      timeoutMs,
    })
  }

  const cacheKey = createCacheKey({
    candidateUrls: input.candidateUrls,
    timeoutMs,
  })
  const nowMs = Date.now()

  if (
    cachedResolution &&
    cachedResolution.key === cacheKey &&
    cachedResolution.expiresAt > nowMs
  ) {
    return cachedResolution.resolution
  }

  const resolution = await probeProductHuntLaunchUrlCandidates({
    candidateUrls: input.candidateUrls,
    fetcher,
    timeoutMs,
  })
  cachedResolution = {
    expiresAt: nowMs + PRODUCT_HUNT_DISCOVERY_CACHE_TTL_MS,
    key: cacheKey,
    resolution,
  }

  return resolution
}
