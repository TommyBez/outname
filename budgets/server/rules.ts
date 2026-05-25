import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { budgetRule } from '@/shared/db/schema'
import type { BudgetRule, UpsertBudgetRuleArgs } from './types'

export async function loadApplicableRules(input: {
  userId: string
  rootAgentId: string
}): Promise<BudgetRule[]> {
  return await db
    .select()
    .from(budgetRule)
    .where(
      and(
        eq(budgetRule.userId, input.userId),
        eq(budgetRule.enabled, true),
        sql`(${budgetRule.agentId} IS NULL OR ${budgetRule.agentId} = ${input.rootAgentId})`
      )
    )
}

export async function listBudgetRulesForUser(
  userId: string
): Promise<BudgetRule[]> {
  return await db.select().from(budgetRule).where(eq(budgetRule.userId, userId))
}

export async function listGeneralBudgetRulesForUser(
  userId: string
): Promise<BudgetRule[]> {
  return await db
    .select()
    .from(budgetRule)
    .where(and(eq(budgetRule.userId, userId), isNull(budgetRule.agentId)))
}

export async function listAgentBudgetRules(input: {
  userId: string
  agentId: string
}): Promise<BudgetRule[]> {
  return await db
    .select()
    .from(budgetRule)
    .where(
      and(
        eq(budgetRule.userId, input.userId),
        eq(budgetRule.agentId, input.agentId)
      )
    )
}

export async function upsertBudgetRule(
  input: UpsertBudgetRuleArgs
): Promise<BudgetRule> {
  if (!Number.isFinite(input.limitUsd) || input.limitUsd <= 0) {
    throw new Error('limitUsd must be a positive number')
  }
  const enabled = input.enabled !== false
  const limit = input.limitUsd.toFixed(6)
  const existingFilter = budgetRuleScopeFilter(input)

  const [existing] = await db
    .select()
    .from(budgetRule)
    .where(existingFilter)
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(budgetRule)
      .set({ limitUsd: limit, enabled, updatedAt: new Date() })
      .where(eq(budgetRule.id, existing.id))
      .returning()
    return updated
  }

  const [inserted] = await db
    .insert(budgetRule)
    .values({
      id: ruleId(),
      userId: input.userId,
      agentId: input.agentId,
      period: input.period,
      limitUsd: limit,
      enabled,
    })
    .returning()
  return inserted
}

export async function deleteBudgetRuleForScope(input: {
  userId: string
  agentId: string | null
  period: UpsertBudgetRuleArgs['period']
}): Promise<boolean> {
  const deleted = await db
    .delete(budgetRule)
    .where(budgetRuleScopeFilter(input))
    .returning()
  return deleted.length > 0
}

function budgetRuleScopeFilter(input: {
  userId: string
  agentId: string | null
  period: UpsertBudgetRuleArgs['period']
}) {
  if (input.agentId) {
    return and(
      eq(budgetRule.userId, input.userId),
      eq(budgetRule.agentId, input.agentId),
      eq(budgetRule.period, input.period)
    )
  }
  return and(
    eq(budgetRule.userId, input.userId),
    isNull(budgetRule.agentId),
    eq(budgetRule.period, input.period)
  )
}

function ruleId(): string {
  return (
    'br_' +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36).slice(-4)
  )
}
