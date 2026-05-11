import { revalidatePath, revalidateTag } from 'next/cache'
import {
  deleteBudgetRuleForScope,
  listAgentBudgetRules,
  upsertBudgetRule,
} from '@/budgets/server/rules'
import type { BudgetPeriod } from '@/budgets/server/types'
import {
  agentTag,
  userAgentsTag,
  userBudgetTag,
} from '@/shared/server/cache-tags'

const BUDGET_PERIOD_KEYS: Array<{
  key: 'daily' | 'weekly' | 'monthly'
  period: BudgetPeriod
}> = [
  { key: 'daily', period: 'daily' },
  { key: 'weekly', period: 'weekly' },
  { key: 'monthly', period: 'monthly' },
]

export async function loadAgentBudget(
  agentId: string,
  userId: string
): Promise<{
  daily: number | null
  weekly: number | null
  monthly: number | null
}> {
  const rules = await listAgentBudgetRules({ userId, agentId })
  const result = { daily: null, weekly: null, monthly: null } as {
    daily: number | null
    weekly: number | null
    monthly: number | null
  }
  for (const rule of rules) {
    if (!rule.enabled) {
      continue
    }
    const limit = Number(rule.limitUsd)
    if (!Number.isFinite(limit) || limit <= 0) {
      continue
    }
    result[rule.period] = limit
  }
  return result
}

export async function applyAgentBudget(input: {
  agentId: string
  userId: string
  daily: number | null
  weekly: number | null
  monthly: number | null
}): Promise<{
  ok: true
  applied: Array<{ period: BudgetPeriod; limitUsd: number | null }>
}> {
  const applied: Array<{ period: BudgetPeriod; limitUsd: number | null }> = []
  for (const { key, period } of BUDGET_PERIOD_KEYS) {
    const value = input[key]
    if (value === null) {
      const removed = await deleteBudgetRuleForScope({
        userId: input.userId,
        agentId: input.agentId,
        period,
      })
      if (removed) {
        applied.push({ period, limitUsd: null })
      }
      continue
    }
    if (!Number.isFinite(value) || value <= 0) {
      continue
    }
    await upsertBudgetRule({
      userId: input.userId,
      agentId: input.agentId,
      period,
      limitUsd: value,
    })
    applied.push({ period, limitUsd: value })
  }
  return { ok: true, applied }
}

export function revalidateAgentEditSurfaces(
  agentId: string,
  userId: string
): void {
  revalidateTag(userAgentsTag(userId), 'max')
  revalidateTag(agentTag(agentId), 'max')
  revalidateTag(userBudgetTag(userId), 'max')
  revalidatePath('/agents')
  revalidatePath(`/agents/${agentId}`)
  revalidatePath(`/agents/${agentId}/configure`)
  revalidatePath(`/agents/${agentId}/edit`)
  revalidatePath('/')
}
