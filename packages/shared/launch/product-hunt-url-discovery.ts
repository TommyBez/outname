import {
  getProductHuntLaunchPhase,
  normalizeProductHuntLaunchUrl,
} from './product-hunt'

const PRODUCT_HUNT_HOST = 'www.producthunt.com'
const PRODUCT_HUNT_HOST_APEX = 'producthunt.com'
const PRODUCT_HUNT_POST_PATH_PREFIX = '/posts/'
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
const PRODUCT_HUNT_POST_URL_PATTERN =
  /https:\/\/(?:www\.)?producthunt\.com\/posts\/[^\s"'<>\\\]]+/gi
const TRAILING_URL_PUNCTUATION = /[),.;:!?]+$/

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

export type ProductHuntLaunchUrlSource =
  | 'candidate'
  | 'env'
  | 'handoff'
  | 'none'

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

function normalizeProductHuntHostname(hostname: string): string | null {
  const normalized = hostname.toLowerCase()
  if (
    normalized === PRODUCT_HUNT_HOST ||
    normalized === PRODUCT_HUNT_HOST_APEX
  ) {
    return PRODUCT_HUNT_HOST
  }
  return null
}

function cleanProductHuntUrlText(value: string): string {
  return value.trim().replace(TRAILING_URL_PUNCTUATION, '')
}

function isProductHuntPostUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const slug = url.pathname.startsWith(PRODUCT_HUNT_POST_PATH_PREFIX)
      ? url.pathname.slice(PRODUCT_HUNT_POST_PATH_PREFIX.length).split('/')[0]
      : ''
    return (
      url.protocol === 'https:' &&
      Boolean(normalizeProductHuntHostname(url.hostname)) &&
      url.pathname.startsWith(PRODUCT_HUNT_POST_PATH_PREFIX) &&
      slug.length > 0 &&
      slug !== 'new'
    )
  } catch {
    return false
  }
}

export function normalizeProductHuntPostUrl(
  value?: string | null
): string | null {
  const cleaned = value ? cleanProductHuntUrlText(value) : value
  const normalized = normalizeProductHuntLaunchUrl(cleaned)
  if (!(normalized && isProductHuntPostUrl(normalized))) {
    return null
  }
  const url = new URL(normalized)
  const hostname = normalizeProductHuntHostname(url.hostname)
  const slug = url.pathname
    .slice(PRODUCT_HUNT_POST_PATH_PREFIX.length)
    .split('/')[0]

  if (!(hostname && slug)) {
    return null
  }

  return `https://${hostname}${PRODUCT_HUNT_POST_PATH_PREFIX}${slug}`
}

function uniqueProductHuntPostUrls(values: Iterable<string | null>): string[] {
  const urls: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    const normalized = normalizeProductHuntPostUrl(value)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      urls.push(normalized)
    }
  }

  return urls
}

export function extractProductHuntPostUrls(value?: string | null): string[] {
  if (!value) {
    return []
  }

  return uniqueProductHuntPostUrls(
    Array.from(value.matchAll(PRODUCT_HUNT_POST_URL_PATTERN), (match) =>
      cleanProductHuntUrlText(match[0])
    )
  )
}

export function parseProductHuntLaunchUrlCandidates(
  value?: string | null
): string[] {
  return [
    ...new Set([
      ...uniqueProductHuntPostUrls(
        value?.split(PRODUCT_HUNT_CANDIDATE_SEPARATOR) ?? []
      ),
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
  source: Exclude<ProductHuntLaunchUrlSource, 'env' | 'none'>
  fetcher: ProductHuntFetch
  timeoutMs: number
  urls: readonly string[]
}): Promise<ProductHuntLaunchUrlResolution> {
  const candidates = await Promise.all(
    input.urls.map((candidate) =>
      probeProductHuntLaunchUrl({
        fetcher: input.fetcher,
        timeoutMs: input.timeoutMs,
        url: candidate,
      })
    )
  )
  const match = candidates.find((candidate) => candidate.ok)

  return {
    candidates,
    source: match ? input.source : 'none',
    url: match?.url ?? null,
  }
}

function createCacheKey(input: {
  candidateUrls?: string | null
  handoffUrls: readonly string[]
  timeoutMs: number
}): string {
  return JSON.stringify({
    candidateUrls: parseProductHuntLaunchUrlCandidates(input.candidateUrls),
    handoffUrls: input.handoffUrls,
    timeoutMs: input.timeoutMs,
  })
}

export async function resolveProductHuntLaunchUrl(input: {
  candidateUrls?: string | null
  explicitUrl?: string | null
  fetcher?: ProductHuntFetch
  handoffUrls?: readonly string[]
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
  const handoffUrls = uniqueProductHuntPostUrls(input.handoffUrls ?? [])
  const handoffUrlSet = new Set(handoffUrls)
  const candidateUrls = parseProductHuntLaunchUrlCandidates(
    input.candidateUrls
  ).filter((candidate) => !handoffUrlSet.has(candidate))

  if (input.fetcher || input.now) {
    const handoffResolution = await probeProductHuntLaunchUrlCandidates({
      fetcher,
      source: 'handoff',
      timeoutMs,
      urls: handoffUrls,
    })

    if (handoffResolution.url) {
      return handoffResolution
    }

    const candidateResolution = await probeProductHuntLaunchUrlCandidates({
      fetcher,
      source: 'candidate',
      timeoutMs,
      urls: candidateUrls,
    })

    return {
      candidates: [
        ...handoffResolution.candidates,
        ...candidateResolution.candidates,
      ],
      source: candidateResolution.source,
      url: candidateResolution.url,
    }
  }

  const cacheKey = createCacheKey({
    candidateUrls: input.candidateUrls,
    handoffUrls,
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

  const handoffResolution = await probeProductHuntLaunchUrlCandidates({
    fetcher,
    source: 'handoff',
    timeoutMs,
    urls: handoffUrls,
  })
  const candidateResolution = handoffResolution.url
    ? null
    : await probeProductHuntLaunchUrlCandidates({
        fetcher,
        source: 'candidate',
        timeoutMs,
        urls: candidateUrls,
      })
  const resolution = handoffResolution.url
    ? handoffResolution
    : {
        candidates: [
          ...handoffResolution.candidates,
          ...(candidateResolution?.candidates ?? []),
        ],
        source: candidateResolution?.source ?? 'none',
        url: candidateResolution?.url ?? null,
      }

  cachedResolution = {
    expiresAt: nowMs + PRODUCT_HUNT_DISCOVERY_CACHE_TTL_MS,
    key: cacheKey,
    resolution,
  }

  return resolution
}
