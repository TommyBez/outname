import type { BudgetExceededInfo } from './types'

export function formatBudgetExceededMessage(info: BudgetExceededInfo): string {
  const layer = info.scope.type === 'general' ? 'general' : 'agent'
  return `Budget exceeded: ${layer} ${info.period} limit of $${info.limitUsd.toFixed(2)} reached ($${info.spentUsd.toFixed(2)} spent).`
}
