/**
 * AI Gateway model catalog.
 *
 * `https://ai-gateway.vercel.sh/v1/models` is open (no auth header
 * needed). It returns the OpenAI Models API envelope shape with
 * Vercel extensions:
 *
 *   {
 *     object: "list",
 *     data: [{
 *       id: "openai/gpt-5-mini",
 *       object: "model",
 *       created: 1730000000,
 *       owned_by: "openai",
 *       name: "GPT-5 Mini",
 *       description: "...",
 *       context_window: 128000,
 *       max_tokens: 16384,
 *       type: "language" | "embedding" | "image" | ...,
 *       tags: ["tool-use", "reasoning", ...],
 *       pricing: { ... }
 *     }, ...]
 *   }
 *
 * We only need a small projection for the agent form, so we map
 * down to `ModelOption` and filter to language models that advertise
 * tool-use (every Phase 2 agent uses memory + exec tools, so a
 * non-tool-use model would silently fail).
 */

export interface ModelOption {
  /** Surfaced as a small hint in the UI; 0 if missing. */
  contextWindow: number
  /** Stored verbatim on `agent.model`, e.g. "openai/gpt-5-mini". */
  id: string
  /** USD per input token. `null` when the gateway didn't report pricing. */
  inputUsdPerToken: number | null
  /** Display label, e.g. "GPT-5 Mini". Falls back to id if missing. */
  name: string
  /** USD per output token. `null` when the gateway didn't report pricing. */
  outputUsdPerToken: number | null
  /** Used to group the <select>, e.g. "openai". */
  ownedBy: string
}

export interface ModelPricing {
  inputUsdPerToken: number
  outputUsdPerToken: number
}

const ENDPOINT = 'https://ai-gateway.vercel.sh/v1/models'

// Permissive fallback used only when the live fetch fails. Keeps the
// form usable in offline / sandboxed dev so a deploy never blocks on
// network jitter.
const FALLBACK: readonly ModelOption[] = [
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    ownedBy: 'openai',
    contextWindow: 128_000,
    inputUsdPerToken: null,
    outputUsdPerToken: null,
  },
  {
    id: 'anthropic/claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    ownedBy: 'anthropic',
    contextWindow: 200_000,
    inputUsdPerToken: null,
    outputUsdPerToken: null,
  },
]

interface RawModel {
  context_window?: number
  id?: string
  name?: string
  owned_by?: string
  pricing?: {
    input?: number | string
    output?: number | string
    cached_input?: number | string
    cache_creation_input?: number | string
  }
  tags?: string[]
  type?: string
}

interface RawResponse {
  data?: RawModel[]
  object?: string
}

function isLanguageToolModel(m: RawModel): m is RawModel & { id: string } {
  if (!m.id || typeof m.id !== 'string') {
    return false
  }
  if (m.type !== 'language') {
    return false
  }
  return Boolean(Array.isArray(m.tags) && m.tags.includes('tool-use'))
}

function parseRate(value: number | string | undefined): number | null {
  if (value === undefined || value === null) {
    return null
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) {
    return null
  }
  return n
}

function rawModelToOption(m: RawModel & { id: string }): ModelOption {
  return {
    id: m.id,
    name: typeof m.name === 'string' && m.name.length > 0 ? m.name : m.id,
    ownedBy:
      typeof m.owned_by === 'string' && m.owned_by.length > 0
        ? m.owned_by
        : (m.id.split('/')[0] ?? 'unknown'),
    contextWindow:
      typeof m.context_window === 'number' && m.context_window > 0
        ? m.context_window
        : 0,
    inputUsdPerToken: parseRate(m.pricing?.input),
    outputUsdPerToken: parseRate(m.pricing?.output),
  }
}

/**
 * Server-only. Fetches the catalog with a 1h revalidate so the form
 * picks up new models within an hour without us redeploying. Result
 * is cached at the Next.js Data Cache layer; no per-request fan-out.
 */
export async function getAvailableModels(): Promise<ModelOption[]> {
  try {
    const res = await fetch(ENDPOINT, {
      // No `Authorization` header — endpoint is open. Adding one
      // would only get us rate-limited against an account we don't
      // need to charge.
      cache: 'force-cache',
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      console.error(
        '[v0] getAvailableModels: non-OK response, using fallback',
        { status: res.status }
      )
      return [...FALLBACK]
    }
    const json = (await res.json()) as RawResponse
    const data = Array.isArray(json?.data) ? json.data : []
    const mapped: ModelOption[] = []
    for (const m of data) {
      if (!isLanguageToolModel(m)) {
        continue
      }
      mapped.push(rawModelToOption(m))
    }
    if (mapped.length === 0) {
      console.error(
        '[v0] getAvailableModels: zero language+tool-use models in response, using fallback'
      )
      return [...FALLBACK]
    }
    mapped.sort((a, b) => {
      if (a.ownedBy !== b.ownedBy) {
        return a.ownedBy.localeCompare(b.ownedBy)
      }
      return a.id.localeCompare(b.id)
    })
    return mapped
  } catch (err) {
    console.error('[v0] getAvailableModels: fetch threw, using fallback', err)
    return [...FALLBACK]
  }
}

/**
 * Validates a model id against the live (or fallback) catalog. Used
 * by `agent-actions.ts` to reject invalid ids at write time. Returns
 * `true` if the id is in the catalog OR if we're currently serving
 * the fallback (so a transient outage doesn't trap users in a bad
 * edit; the next agent-action call will revalidate).
 */
export async function isModelIdValid(modelId: string): Promise<boolean> {
  const list = await getAvailableModels()
  // If we're on the fallback (signaled by length === FALLBACK.length
  // and id-set equality), be permissive — the user could be picking a
  // perfectly valid id we just can't see right now.
  const isFallback =
    list.length === FALLBACK.length &&
    list.every((o, i) => o.id === FALLBACK[i]?.id)
  if (isFallback) {
    return true
  }
  return list.some((o) => o.id === modelId)
}

/** Default model used when seeding fresh agents. */
export const DEFAULT_MODEL_ID = 'openai/gpt-5-mini'

/**
 * Per-token pricing for a single model. Returns `null` when the
 * gateway didn't advertise pricing (e.g. catalog fallback in dev) so
 * callers can decide whether to cost the call as zero or skip
 * persistence entirely.
 */
export async function getModelPricing(
  modelId: string
): Promise<ModelPricing | null> {
  const list = await getAvailableModels()
  const hit = list.find((m) => m.id === modelId)
  if (!hit) {
    return null
  }
  if (hit.inputUsdPerToken === null || hit.outputUsdPerToken === null) {
    return null
  }
  return {
    inputUsdPerToken: hit.inputUsdPerToken,
    outputUsdPerToken: hit.outputUsdPerToken,
  }
}
