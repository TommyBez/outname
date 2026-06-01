import 'server-only'

import { db } from '@outname/db'
import { agentTokenUsage } from '@outname/db/schema'
import { getModelPricing } from '@outname/shared/server/ai-gateway-models'
import type { LanguageModelUsage } from 'ai'

interface UsageInput {
  cachedInputTokens?: number
  inputTokens?: number
  outputTokens?: number
  reasoningTokens?: number
  totalTokens?: number
}

export async function recordAgentTokenUsage(input: {
  userId: string
  agentId: string
  rootAgentId: string
  sourceType: 'chat' | 'heartbeat' | 'dreaming' | 'invocation'
  sourceId?: string | null
  model: string
  usage: LanguageModelUsage | UsageInput | undefined
}): Promise<void> {
  const usage = readUsage(input.usage)
  if (
    usage.input === 0 &&
    usage.output === 0 &&
    usage.total === 0 &&
    usage.reasoning === 0 &&
    usage.cachedInput === 0
  ) {
    return
  }

  const pricing = await getModelPricing(input.model).catch(() => null)
  const inputRate = pricing?.inputUsdPerToken ?? 0
  const outputRate = pricing?.outputUsdPerToken ?? 0
  const costUsd = usage.input * inputRate + usage.output * outputRate

  await db.insert(agentTokenUsage).values({
    id: `tu_${Math.random().toString(36).slice(2)}${Date.now().toString(36).slice(-4)}`,
    userId: input.userId,
    agentId: input.agentId,
    rootAgentId: input.rootAgentId,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    model: input.model,
    inputTokens: usage.input,
    outputTokens: usage.output,
    reasoningTokens: usage.reasoning,
    cachedInputTokens: usage.cachedInput,
    totalTokens: usage.total,
    costUsd: costUsd.toFixed(9),
    inputRateUsdPerToken: pricing ? inputRate.toFixed(12) : null,
    outputRateUsdPerToken: pricing ? outputRate.toFixed(12) : null,
  })
}

function readUsage(usage: LanguageModelUsage | UsageInput | undefined): {
  input: number
  output: number
  total: number
  reasoning: number
  cachedInput: number
} {
  const value = (usage ?? {}) as UsageInput
  const input = numberOrZero(value.inputTokens)
  const output = numberOrZero(value.outputTokens)
  const reasoning = numberOrZero(value.reasoningTokens)
  const cachedInput = numberOrZero(value.cachedInputTokens)
  const total = numberOrZero(value.totalTokens) || input + output
  return { input, output, total, reasoning, cachedInput }
}

function numberOrZero(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0
  }
  return Math.floor(value)
}
