export interface ModelOption {
  contextWindow: number
  id: string
  inputUsdPerToken: number | null
  name: string
  outputUsdPerToken: number | null
  ownedBy: string
}

export interface ModelPricing {
  inputUsdPerToken: number
  outputUsdPerToken: number
}

const ENDPOINT = 'https://ai-gateway.vercel.sh/v1/models'

// Fallback keeps the form usable when the live catalog fetch fails.
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

// Server-only cached catalog fetch for the agent form.
export async function getAvailableModels(): Promise<ModelOption[]> {
  try {
    const res = await fetch(ENDPOINT, {
      // The endpoint is public; sending auth would only burn an account quota.
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

// Be permissive when the fallback catalog is serving so a transient catalog
// outage does not trap users in a failed edit flow.
export async function isModelIdValid(modelId: string): Promise<boolean> {
  const list = await getAvailableModels()
  // Detect fallback mode by exact list equality.
  const isFallback =
    list.length === FALLBACK.length &&
    list.every((o, i) => o.id === FALLBACK[i]?.id)
  if (isFallback) {
    return true
  }
  return list.some((o) => o.id === modelId)
}

export const DEFAULT_MODEL_ID = 'deepseek/deepseek-v4-flash'

// Return `null` when pricing is missing so callers can skip persistence or cost
// the call as zero explicitly.
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
