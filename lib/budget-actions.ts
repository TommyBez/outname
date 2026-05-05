'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { requireSession } from '@/lib/auth-guard'
import { userBudgetTag } from '@/lib/cache-tags'
import { db } from '@/lib/db'
import {
  agent as agentTable,
  type BudgetPeriod,
  budgetRule,
} from '@/lib/db/schema'

const ALLOWED_PERIODS = new Set<BudgetPeriod>(['daily', 'weekly', 'monthly'])

function ruleId() {
  return (
    'br_' +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36).slice(-4)
  )
}

function normalizeLimit(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Limit must be a positive number')
  }
  // Round to 6 decimals to match the column scale.
  return n.toFixed(6)
}

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
 * Idempotent upsert: at most one rule per (user, scope, period). Calling
 * with the same scope/period twice updates the existing row instead of
 * creating a duplicate (the unique partial indexes on `budget_rule`
 * also enforce this at the DB level).
 */
export async function upsertBudgetRuleAction(
  input: UpsertBudgetRuleInput
): Promise<void> {
  const session = await requireSession()
  const userId = session.user.id
  const period = normalizePeriod(input.period)
  const limit = normalizeLimit(input.limitUsd)
  const enabled = input.enabled !== false
  const agentId = input.agentId ?? null

  if (agentId) {
    await assertAgentOwnership({ agentId, userId })
  }

  const existingFilter = agentId
    ? and(
        eq(budgetRule.userId, userId),
        eq(budgetRule.agentId, agentId),
        eq(budgetRule.period, period)
      )
    : and(
        eq(budgetRule.userId, userId),
        isNull(budgetRule.agentId),
        eq(budgetRule.period, period)
      )

  const [existing] = await db
    .select()
    .from(budgetRule)
    .where(existingFilter)
    .limit(1)

  if (existing) {
    await db
      .update(budgetRule)
      .set({
        limitUsd: limit,
        enabled,
        updatedAt: new Date(),
      })
      .where(eq(budgetRule.id, existing.id))
  } else {
    await db.insert(budgetRule).values({
      id: ruleId(),
      userId,
      agentId,
      period,
      limitUsd: limit,
      enabled,
    })
  }

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
