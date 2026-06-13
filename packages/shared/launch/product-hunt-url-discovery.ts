import {
  getProductHuntLaunchPhase,
  normalizeProductHuntLaunchUrl,
} from './product-hunt'

const PRODUCT_HUNT_HOST = 'www.producthunt.com'
const PRODUCT_HUNT_DISCOVERY_TIMEOUT_MS = 3500
const PRODUCT_HUNT_DISCOVERY_BODY_LIMIT = 128 * 1024
const PRODUCT_HUNT_BODY_MARKERS = ['outna.me', 'outna', 'hosted ai agents']
const PRODUCT_HUNT_CANDIDATE_SEPARATOR = /[\s,]+/

export const PRODUCT_HUNT_DEFAULT_LAUNCH_URL_CANDIDATES = [
  'https://www.producthunt.com/posts/outna-me',
  'https://www.producthunt.com/posts/outname',
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
    const hasProductMarker = PRODUCT_HUNT_BODY_MARKERS.some((marker) =>
      body.includes(marker)
    )

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
  const candidates: ProductHuntLaunchUrlProbe[] = []
  for (const candidate of parseProductHuntLaunchUrlCandidates(
    input.candidateUrls
  )) {
    const probe = await probeProductHuntLaunchUrl({
      fetcher,
      timeoutMs: input.timeoutMs ?? PRODUCT_HUNT_DISCOVERY_TIMEOUT_MS,
      url: candidate,
    })
    candidates.push(probe)

    if (probe.ok) {
      return { candidates, source: 'candidate', url: probe.url }
    }
  }

  return { candidates, source: 'none', url: null }
}
