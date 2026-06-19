import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
  type ToolPart,
} from '@outname/ai/components/ai-elements/tool'
import {
  type AgentBudgetValues,
  formatBudgetSummary,
} from '@outname/shared/agents/components/agent-budget-values'
import { AgentBudgetWidget } from '@outname/shared/agents/components/agent-budget-widget'
import { useState } from 'react'
import type { SendMessageFn } from './types'
import { isRecord } from './value-utils'

interface ProposeBudgetInput {
  daily?: number | null
  monthly?: number | null
  rationale?: string
  weekly?: number | null
}

interface ProposeBudgetOutput {
  proposed: AgentBudgetValues
  rationale?: string
}

export function ProposeBudgetCard({
  currentBudget,
  part,
  sendMessage,
}: {
  currentBudget: AgentBudgetValues
  part: ToolPart
  sendMessage: SendMessageFn
}) {
  const [submitted, setSubmitted] = useState(false)

  const input = (part.input ?? {}) as ProposeBudgetInput
  const output =
    part.state === 'output-available'
      ? ((part.output ?? {}) as ProposeBudgetOutput)
      : null
  const proposed: AgentBudgetValues = output
    ? output.proposed
    : {
        daily: input.daily ?? null,
        weekly: input.weekly ?? null,
        monthly: input.monthly ?? null,
      }
  const rationale = output?.rationale ?? input.rationale ?? ''

  if (part.state === 'input-streaming' || part.state === 'input-available') {
    return (
      <Tool>
        <ToolHeader
          state={part.state}
          type={part.type as Exclude<ToolPart['type'], 'dynamic-tool'>}
        />
      </Tool>
    )
  }

  if (part.state === 'output-error') {
    return (
      <Tool defaultOpen>
        <ToolHeader
          state={part.state}
          type={part.type as Exclude<ToolPart['type'], 'dynamic-tool'>}
        />
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
    setSubmitted(true)
    const summary = formatBudgetSummary(values)
    sendMessage({
      text: `Set the per-agent budget to:\n${summary}\nNow call set_agent_budget with these values (use null for any "none" entries).`,
    })
  }

  return (
    <Tool defaultOpen>
      <ToolHeader
        state={part.state}
        type={part.type as Exclude<ToolPart['type'], 'dynamic-tool'>}
      />
      <ToolContent>
        <AgentBudgetWidget
          applyLabel="Apply budget"
          current={currentBudget}
          onApply={submit}
          onSkip={() => submit({ daily: null, weekly: null, monthly: null })}
          proposed={proposed}
          rationale={rationale}
          skipLabel="Clear all"
          submitted={submitted}
          title="Adjust agent budget"
        />
      </ToolContent>
    </Tool>
  )
}

export function BudgetApprovalPreview({
  currentBudget,
  input,
}: {
  currentBudget: AgentBudgetValues
  input: unknown
}) {
  const proposed = readBudgetFromUnknown(input)
  const rows = [
    { label: 'Daily', current: currentBudget.daily, proposed: proposed.daily },
    {
      label: 'Weekly',
      current: currentBudget.weekly,
      proposed: proposed.weekly,
    },
    {
      label: 'Monthly',
      current: currentBudget.monthly,
      proposed: proposed.monthly,
    },
  ]
  return (
    <section className="border border-border bg-background">
      <div className="border-border border-b px-3 py-2">
        <p className="font-bold text-xs">Budget changes</p>
      </div>
      <dl className="divide-y divide-border">
        {rows.map((row) => (
          <div
            className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[8rem_minmax(0,1fr)]"
            key={row.label}
          >
            <dt className="font-bold">{row.label}</dt>
            <dd className="min-w-0 font-mono">
              <span className="text-muted-foreground line-through">
                {formatLimitForReview(row.current)}
              </span>
              <span className="mx-2 text-muted-foreground">→</span>
              <span>{formatLimitForReview(row.proposed)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function readBudgetFromUnknown(value: unknown): AgentBudgetValues {
  const obj = isRecord(value) ? value : {}
  return {
    daily: typeof obj.daily === 'number' ? obj.daily : null,
    weekly: typeof obj.weekly === 'number' ? obj.weekly : null,
    monthly: typeof obj.monthly === 'number' ? obj.monthly : null,
  }
}

function formatLimitForReview(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return 'none'
  }
  return `$${value.toFixed(2)}`
}
