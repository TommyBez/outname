import type { BudgetPeriod } from './types'

export const BUDGET_PERIODS: readonly BudgetPeriod[] = [
  'daily',
  'weekly',
  'monthly',
] as const

export function periodStart(
  period: BudgetPeriod,
  now: Date = new Date()
): Date {
  const utc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  switch (period) {
    case 'daily':
      return utc
    case 'weekly': {
      const day = utc.getUTCDay() || 7
      const monday = new Date(utc)
      monday.setUTCDate(utc.getUTCDate() - (day - 1))
      return monday
    }
    case 'monthly':
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    default: {
      const _exhaustive: never = period
      throw new Error(`Unsupported period: ${String(_exhaustive)}`)
    }
  }
}
