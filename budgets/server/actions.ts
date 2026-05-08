'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { requireSession } from '@/auth/server/auth-guard'
import { upsertBudgetRule } from '@/budgets/server/rules'
import { db } from '@/shared/db'
import {
  agent as agentTable,
  type BudgetPeriod,
  budgetRule,
} from '@/shared/db/schema'
import { userBudgetTag } from '@/shared/server/cache-tags'

const ALLOWED_PERIODS = new Set<BudgetPeriod>(['daily', 'weekly', 'monthly'])

function normalizePeriod(value: unknown): BudgetPeriod {
  if (
    typeof value !== 'string' ||
    !ALLOWED_PERIODS.has(value as BudgetPeriod)
  ) {
    throw new Error('Invalid period')
  }
  return value as BudgetPeriod
}

async function assertAgentOwnership(input: {
  agentId: string
  userId: string
}): Promise<void> {
  const [row] = await db
    .select({ id: agentTable.id })
    .from(agentTable)
    .where(
      and(eq(agentTable.id, input.agentId), eq(agentTable.userId, input.userId))
    )
    .limit(1)
  if (!row) {
    throw new Error('Agent not found')
  }
}

export interface UpsertBudgetRuleInput {
  /** Omit / null for the user-wide general budget. */
  agentId?: string | null
  enabled?: boolean
  /** USD limit. Must be positive. */
  limitUsd: number
  period: BudgetPeriod
}

/**
 * Server Action shim around `upsertBudgetRule`. Adds session-bound
 * ownership and cache revalidation; the heavy lifting lives in
 * `lib/budget.ts` so non-action callers (e.g. agent-creation chat)
 * can share the same logic.
 */
export async function upsertBudgetRuleAction(
  input: UpsertBudgetRuleInput
): Promise<void> {
  const session = await requireSession()
  const userId = session.user.id
  const period = normalizePeriod(input.period)
  const agentId = input.agentId ?? null

  if (agentId) {
    await assertAgentOwnership({ agentId, userId })
  }

  await upsertBudgetRule({
    userId,
    agentId,
    period,
    limitUsd: input.limitUsd,
    enabled: input.enabled,
  })

  updateTag(userBudgetTag(userId))
  revalidatePath('/settings')
  if (agentId) {
    revalidatePath(`/agents/${agentId}/edit`)
  }
}

export async function deleteBudgetRuleAction(ruleId: string): Promise<void> {
  const session = await requireSession()
  const [existing] = await db
    .select()
    .from(budgetRule)
    .where(
      and(eq(budgetRule.id, ruleId), eq(budgetRule.userId, session.user.id))
    )
    .limit(1)
  if (!existing) {
    return
  }
  await db.delete(budgetRule).where(eq(budgetRule.id, ruleId))
  updateTag(userBudgetTag(session.user.id))
  revalidatePath('/settings')
  if (existing.agentId) {
    revalidatePath(`/agents/${existing.agentId}/edit`)
  }
}

export async function setBudgetRuleEnabledAction(input: {
  ruleId: string
  enabled: boolean
}): Promise<void> {
  const session = await requireSession()
  const [existing] = await db
    .select()
    .from(budgetRule)
    .where(
      and(
        eq(budgetRule.id, input.ruleId),
        eq(budgetRule.userId, session.user.id)
      )
    )
    .limit(1)
  if (!existing) {
    return
  }
  await db
    .update(budgetRule)
    .set({ enabled: input.enabled, updatedAt: new Date() })
    .where(eq(budgetRule.id, input.ruleId))
  updateTag(userBudgetTag(session.user.id))
  revalidatePath('/settings')
  if (existing.agentId) {
    revalidatePath(`/agents/${existing.agentId}/edit`)
  }
}
