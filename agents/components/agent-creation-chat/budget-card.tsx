import { AlertTriangleIcon, CircleDashedIcon } from 'lucide-react'
import { useState } from 'react'
import {
  type AgentBudgetValues,
  AgentBudgetWidget,
  formatBudgetSummary,
} from '@/agents/components/agent-budget-widget'
import type { ProposeBudgetToolPart, SendMessageFn } from './types'

export function ProposeBudgetCard({
  part,
  sendMessage,
}: {
  part: ProposeBudgetToolPart
  sendMessage: SendMessageFn
}) {
  const proposed: AgentBudgetValues = {
    daily: part.output?.proposed.daily ?? part.input?.daily ?? null,
    weekly: part.output?.proposed.weekly ?? part.input?.weekly ?? null,
    monthly: part.output?.proposed.monthly ?? part.input?.monthly ?? null,
  }
  const rationale = part.output?.rationale ?? part.input?.rationale ?? ''
  const [submitted, setSubmitted] = useState(false)

  if (part.state === 'input-streaming' || part.state === 'input-available') {
    return (
      <div className="w-full border-2 border-foreground bg-muted p-4">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-[0.16em]">
          <CircleDashedIcon className="size-4 animate-spin" />
          Drafting budget suggestion
        </div>
      </div>
    )
  }

  if (part.state === 'output-error') {
    return (
      <div className="w-full border-2 border-destructive bg-destructive/5 p-4 text-destructive text-sm">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-[0.16em]">
          <AlertTriangleIcon className="size-4" />
          Budget proposal failed
        </div>
        <p className="mt-2">{part.errorText ?? 'Unknown error.'}</p>
      </div>
    )
  }

  if (part.state !== 'output-available') {
    return null
  }

  function submit(values: AgentBudgetValues) {
    if (submitted) {
      return
    }
    setSubmitted(true)
    const summary = formatBudgetSummary(values)
    sendMessage({
      text: `Use this per-agent budget when creating the agent:\n${summary}\nNow proceed to call create_requested_agent with the full configuration including this budget.`,
    })
  }

  return (
    <AgentBudgetWidget
      onApply={submit}
      onSkip={() => submit({ daily: null, weekly: null, monthly: null })}
      proposed={proposed}
      rationale={rationale}
      submitted={submitted}
    />
  )
}
