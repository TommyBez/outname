'use client'

import { CheckIcon, WalletIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export interface AgentBudgetValues {
  daily: number | null
  monthly: number | null
  weekly: number | null
}

interface Props {
  /** Apply button label; defaults to "Apply budget". */
  applyLabel?: string
  /** Operator's current budget snapshot, shown alongside the proposal. */
  current?: AgentBudgetValues
  onApply: (values: AgentBudgetValues) => void
  onSkip: () => void
  /** Agent's suggested values, used as form defaults when no current value exists. */
  proposed: AgentBudgetValues
  /** Optional one-line reason rendered above the form. */
  rationale?: string
  /** Skip button label; defaults to "Skip budget". */
  skipLabel?: string
  /** Disables inputs once the user has submitted the values. */
  submitted: boolean
  /** Header label; defaults to "Set agent budget". */
  title?: string
}

interface BudgetDraft {
  daily: string
  monthly: string
  weekly: string
}

function toDraft(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return ''
  }
  return value.toString()
}

function parseDraft(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0) {
    return null
  }
  return n
}

function pickInitialDraft(
  current: AgentBudgetValues | undefined,
  proposed: AgentBudgetValues
): BudgetDraft {
  return {
    daily: toDraft(current?.daily ?? proposed.daily),
    weekly: toDraft(current?.weekly ?? proposed.weekly),
    monthly: toDraft(current?.monthly ?? proposed.monthly),
  }
}

export function AgentBudgetWidget({
  applyLabel,
  current,
  onApply,
  onSkip,
  proposed,
  rationale,
  skipLabel,
  submitted,
  title,
}: Props) {
  const [draft, setDraft] = useState<BudgetDraft>(() =>
    pickInitialDraft(current, proposed)
  )

  function handleApply() {
    onApply({
      daily: parseDraft(draft.daily),
      weekly: parseDraft(draft.weekly),
      monthly: parseDraft(draft.monthly),
    })
  }

  return (
    <section className="w-full border-2 border-foreground bg-background">
      <div className="flex items-center gap-2 border-foreground border-b-2 bg-accent px-4 py-3">
        <WalletIcon className="size-4" />
        <p className="font-bold text-xs uppercase tracking-[0.18em]">
          {title ?? 'Set agent budget'}
        </p>
      </div>
      <div className="space-y-4 p-4">
        {rationale ? (
          <p className="text-muted-foreground text-sm">{rationale}</p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          USD spend caps for this agent. Sub-agent runs roll into these numbers.
          External-service tool costs are not counted. Leave a field empty to
          skip that period.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <BudgetField
            current={current?.daily ?? null}
            disabled={submitted}
            label="Daily"
            onChange={(value) => setDraft((d) => ({ ...d, daily: value }))}
            value={draft.daily}
          />
          <BudgetField
            current={current?.weekly ?? null}
            disabled={submitted}
            label="Weekly"
            onChange={(value) => setDraft((d) => ({ ...d, weekly: value }))}
            value={draft.weekly}
          />
          <BudgetField
            current={current?.monthly ?? null}
            disabled={submitted}
            label="Monthly"
            onChange={(value) => setDraft((d) => ({ ...d, monthly: value }))}
            value={draft.monthly}
          />
        </div>
        {submitted ? (
          <p className="font-bold text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
            Submitted ✓
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleApply} type="button">
              <CheckIcon className="size-4" />
              {applyLabel ?? 'Apply budget'}
            </Button>
            <Button onClick={onSkip} type="button" variant="outline">
              <XIcon className="size-4" />
              {skipLabel ?? 'Skip budget'}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

function BudgetField({
  current,
  disabled,
  label,
  onChange,
  value,
}: {
  current: number | null
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
        {label} (USD)
      </span>
      <input
        className="h-10 border-2 border-foreground bg-background px-2 font-mono text-sm outline-none focus:border-accent disabled:opacity-60"
        disabled={disabled}
        inputMode="decimal"
        min="0"
        onChange={(event) => onChange(event.target.value)}
        placeholder="—"
        step="0.01"
        type="number"
        value={value}
      />
      {current === null ? null : (
        <span className="font-mono text-[10px] text-muted-foreground">
          current: ${current.toFixed(2)}
        </span>
      )}
    </label>
  )
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
