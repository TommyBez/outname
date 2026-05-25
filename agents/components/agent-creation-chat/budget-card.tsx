import { useState } from 'react'
import {
  type AgentBudgetValues,
  AgentBudgetWidget,
  formatBudgetSummary,
} from '@/agents/components/agent-budget-widget'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
} from '@/components/ai-elements/tool'
import type { ProposeBudgetToolPart, SendMessageFn } from './types'

export function ProposeBudgetCard({
  part,
  sendMessage,
  requireAiGatewayKey,
}: {
  part: ProposeBudgetToolPart
  requireAiGatewayKey: () => boolean
  sendMessage: SendMessageFn
}) {
  const proposed: AgentBudgetValues = {
    daily: part.output?.proposed.daily ?? part.input?.daily ?? null,
    weekly: part.output?.proposed.weekly ?? part.input?.weekly ?? null,
    monthly: part.output?.proposed.monthly ?? part.input?.monthly ?? null,
  }
  const rationale = part.output?.rationale ?? part.input?.rationale ?? ''
  const [submitted, setSubmitted] = useState(false)

  // Streaming states show only the Tool header with its built-in
  // "Pending"/"Running" badge — no redundant loading panel.
  if (part.state === 'input-streaming' || part.state === 'input-available') {
    return (
      <Tool>
        <ToolHeader state={part.state} type={part.type} />
      </Tool>
    )
  }

  if (part.state === 'output-error') {
    return (
      <Tool defaultOpen>
        <ToolHeader state={part.state} type={part.type} />
        <ToolContent>
          <ToolOutput
            errorText={part.errorText ?? 'Budget proposal failed.'}
            output={undefined}
          />
        </ToolContent>
      </Tool>
    )
  }

  if (part.state !== 'output-available') {
    return null
  }

  function submit(values: AgentBudgetValues) {
    if (submitted) {
      return
    }
    if (!requireAiGatewayKey()) {
      return
    }
    setSubmitted(true)
    const summary = formatBudgetSummary(values)
    sendMessage({
      text: `Use this per-agent budget when creating the agent:\n${summary}\nNow proceed to call create_requested_agent with the full configuration including this budget.`,
    })
  }

  return (
    <Tool defaultOpen>
      <ToolHeader state={part.state} type={part.type} />
      <ToolContent>
        <AgentBudgetWidget
          onApply={submit}
          onSkip={() => submit({ daily: null, weekly: null, monthly: null })}
          proposed={proposed}
          rationale={rationale}
          submitted={submitted}
        />
      </ToolContent>
    </Tool>
  )
}
