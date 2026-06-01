export interface AgentBudgetValues {
  daily: number | null
  monthly: number | null
  weekly: number | null
}

export function formatBudgetSummary(values: AgentBudgetValues): string {
  const lines: string[] = []
  lines.push(
    values.daily ? `- daily: $${values.daily.toFixed(2)}` : '- daily: none'
  )
  lines.push(
    values.weekly ? `- weekly: $${values.weekly.toFixed(2)}` : '- weekly: none'
  )
  lines.push(
    values.monthly
      ? `- monthly: $${values.monthly.toFixed(2)}`
      : '- monthly: none'
  )
  return lines.join('\n')
}
