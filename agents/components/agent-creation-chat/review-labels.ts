import { formatAgentCadenceLower } from '@/agents/format'
import type { AgentCreationRequest } from '@/agents/server/creation-types'

export function scheduleLabel(
  schedule: AgentCreationRequest['heartbeat']
): string {
  if (!schedule.enabled) {
    return 'off'
  }
  return formatAgentCadenceLower(schedule.intervalMinutes)
}

export function stepLimitLabel(
  stepLimit: AgentCreationRequest['stepLimit']
): string {
  if (stepLimit.mode !== 'custom') {
    return stepLimit.mode
  }
  return `custom (${stepLimit.custom ?? 30})`
}

export function budgetReviewLines(
  budget: AgentCreationRequest['budget'] | undefined
): string[] {
  if (!budget) {
    return ['No budget set']
  }
  const lines: string[] = []
  if (budget.daily && budget.daily > 0) {
    lines.push(`Daily: $${budget.daily.toFixed(2)}`)
  }
  if (budget.weekly && budget.weekly > 0) {
    lines.push(`Weekly: $${budget.weekly.toFixed(2)}`)
  }
  if (budget.monthly && budget.monthly > 0) {
    lines.push(`Monthly: $${budget.monthly.toFixed(2)}`)
  }
  if (lines.length === 0) {
    return ['No budget set']
  }
  return lines
}
