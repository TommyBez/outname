import type { BudgetPeriod } from '@/shared/db/schema'

export type { BudgetPeriod, BudgetRule } from '@/shared/db/schema'

export interface BudgetScopeAgent {
  agentId: string
  type: 'agent'
}

export interface BudgetScopeGeneral {
  type: 'general'
}

export type BudgetScope = BudgetScopeAgent | BudgetScopeGeneral

export interface BudgetExceededInfo {
  limitUsd: number
  period: BudgetPeriod
  scope: BudgetScope
  spentUsd: number
}

export interface BudgetSummaryEntry {
  enabled: boolean
  limitUsd: number
  period: BudgetPeriod
  spentUsd: number
}

export interface UpsertBudgetRuleArgs {
  agentId: string | null
  enabled?: boolean
  limitUsd: number
  period: BudgetPeriod
  userId: string
}
