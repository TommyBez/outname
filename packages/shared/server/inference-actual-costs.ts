import 'server-only'

import { setTimeout as sleep } from 'node:timers/promises'
import { readUserInferenceCredentialApiKey } from './inference-credentials'
import { inferenceProviderGenerationLookupRequest } from './inference-provider-registry'
import type { InferenceProvider } from './inference-providers'
import {
  type ActualModelCost,
  extractActualModelCostFromObservation,
  extractActualVercelGatewayCost,
  type GenerationUsageObservation,
} from './model-costs'

const VERCEL_GENERATION_LOOKUP_DELAYS_MS = [0, 1000, 3000] as const
const VERCEL_GENERATION_LOOKUP_TIMEOUT_MS = 2000

export interface ActualCostResolution {
  actualCost: ActualModelCost | null
  unavailableReason: string | null
}

export async function resolveActualModelCost(input: {
  userId: string
  inferenceProvider: InferenceProvider
  observation: GenerationUsageObservation
}): Promise<ActualCostResolution> {
  if (input.inferenceProvider === 'vercel-ai-gateway') {
    return await resolveVercelAiGatewayActualCost(input)
  }

  const actualCost = extractActualModelCostFromObservation({
    inferenceProvider: input.inferenceProvider,
    observation: input.observation,
  })
  return {
    actualCost,
    unavailableReason: actualCost ? null : actualCostUnavailableReason(input),
  }
}

async function resolveVercelAiGatewayActualCost(input: {
  userId: string
  inferenceProvider: InferenceProvider
  observation: GenerationUsageObservation
}): Promise<ActualCostResolution> {
  let apiKey: string
  try {
    apiKey = await readUserInferenceCredentialApiKey({
      inferenceProvider: input.inferenceProvider,
      userId: input.userId,
    })
  } catch {
    return {
      actualCost: null,
      unavailableReason: 'credential_unavailable',
    }
  }

  const request = inferenceProviderGenerationLookupRequest({
    apiKey,
    generationId: input.observation.generationId,
    provider: input.inferenceProvider,
  })
  if (!request) {
    return {
      actualCost: null,
      unavailableReason: 'generation_lookup_unavailable',
    }
  }

  for (const [index, delayMs] of VERCEL_GENERATION_LOOKUP_DELAYS_MS.entries()) {
    if (delayMs > 0) {
      await sleep(delayMs)
    }

    const response = await fetchJsonWithTimeout(request)
    if (response.kind === 'network-error') {
      return {
        actualCost: null,
        unavailableReason: 'generation_lookup_failed',
      }
    }
    if (response.status === 404) {
      const hasNextAttempt =
        index < VERCEL_GENERATION_LOOKUP_DELAYS_MS.length - 1
      if (hasNextAttempt) {
        continue
      }
      return {
        actualCost: null,
        unavailableReason: 'generation_not_ready',
      }
    }
    if (!response.ok) {
      return {
        actualCost: null,
        unavailableReason: `generation_lookup_http_${response.status}`,
      }
    }

    const actualCost = extractActualVercelGatewayCost({
      generation: response.body,
      generationId: input.observation.generationId,
    })
    return {
      actualCost,
      unavailableReason: actualCost ? null : 'missing_documented_cost',
    }
  }

  return {
    actualCost: null,
    unavailableReason: 'generation_not_ready',
  }
}

async function fetchJsonWithTimeout(request: {
  init?: RequestInit
  url: string
}): Promise<
  | {
      body: Record<string, unknown>
      kind: 'response'
      ok: boolean
      status: number
    }
  | { kind: 'network-error' }
> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    VERCEL_GENERATION_LOOKUP_TIMEOUT_MS
  )
  try {
    const response = await fetch(request.url, {
      ...(request.init ?? {}),
      cache: 'no-store',
      signal: controller.signal,
    })
    const body = await response.json().catch(() => ({}))
    return {
      body:
        body && typeof body === 'object'
          ? (body as Record<string, unknown>)
          : {},
      kind: 'response',
      ok: response.ok,
      status: response.status,
    }
  } catch {
    return { kind: 'network-error' }
  } finally {
    clearTimeout(timeout)
  }
}

function actualCostUnavailableReason(input: {
  inferenceProvider: InferenceProvider
  observation: GenerationUsageObservation
}): string {
  if (!input.observation.rawUsage) {
    return 'missing_raw_usage'
  }
  if (
    input.inferenceProvider === 'llm-gateway' ||
    input.inferenceProvider === 'openrouter'
  ) {
    return 'missing_documented_cost'
  }
  return 'actual_cost_not_supported'
}
