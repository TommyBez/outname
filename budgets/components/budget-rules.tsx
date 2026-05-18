'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  deleteBudgetRuleAction,
  setBudgetRuleEnabledAction,
  upsertBudgetRuleAction,
} from '@/budgets/server/actions'
import { Button } from '@/components/ui/button'
import type { BudgetPeriod } from '@/shared/db/schema'

const PERIODS: readonly { id: BudgetPeriod; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
] as const

export interface BudgetRuleView {
  agentId: string | null
  agentName: string | null
  enabled: boolean
  id: string
  limitUsd: number
  period: BudgetPeriod
  /** USD spent in the active period window. */
  spentUsd: number
}

interface Props {
  rules: BudgetRuleView[]
  /**
   * Scope this UI manages:
   *   - `general` — user-wide rules across every agent.
   *   - `{ agentId, agentName }` — per-agent rules for a single agent.
   */
  scope:
    | { type: 'general' }
    | { type: 'agent'; agentId: string; agentName: string }
}

function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '$0.00'
  }
  if (amount >= 1) {
    return `$${amount.toFixed(2)}`
  }
  if (amount >= 0.01) {
    return `$${amount.toFixed(3)}`
  }
  if (amount === 0) {
    return '$0.00'
  }
  return `$${amount.toFixed(4)}`
}

function pctOfLimit(spent: number, limit: number): number {
  if (limit <= 0) {
    return 0
  }
  return Math.min(100, Math.max(0, (spent / limit) * 100))
}

export function BudgetRules({ rules, scope }: Props) {
  const existing = new Map<BudgetPeriod, BudgetRuleView>()
  for (const r of rules) {
    existing.set(r.period, r)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-xs">
        {scope.type === 'general'
          ? 'General budgets cap total AI spend across every agent. Sub-agent invocations roll into the parent agent that the operator started.'
          : `Per-agent budgets cap AI spend on ${scope.agentName}. Sub-agents invoked from this agent count against this budget too. External-service tools are not counted.`}
      </p>
      <ul className="flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
        {PERIODS.map((p) => (
          <li className="py-5" key={p.id}>
            <BudgetRow
              period={p}
              rule={existing.get(p.id) ?? null}
              scope={scope}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function BudgetRow({
  period,
  rule,
  scope,
}: {
  period: { id: BudgetPeriod; label: string }
  rule: BudgetRuleView | null
  scope: Props['scope']
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [draftLimit, setDraftLimit] = useState<string>(
    rule ? rule.limitUsd.toString() : ''
  )

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = Number(draftLimit)
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a positive USD limit')
      return
    }
    startTransition(async () => {
      try {
        await upsertBudgetRuleAction({
          agentId: scope.type === 'agent' ? scope.agentId : null,
          period: period.id,
          limitUsd: value,
          enabled: rule?.enabled ?? true,
        })
        toast.success(`${period.label} budget saved`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  function onToggle() {
    if (!rule) {
      return
    }
    startTransition(async () => {
      await setBudgetRuleEnabledAction({
        ruleId: rule.id,
        enabled: !rule.enabled,
      })
      router.refresh()
    })
  }

  function onRemove() {
    if (!rule) {
      return
    }
    startTransition(async () => {
      await deleteBudgetRuleAction(rule.id)
      toast.success(`${period.label} budget removed`)
      router.refresh()
    })
  }

  const overBudget = rule ? rule.spentUsd >= rule.limitUsd : false
  const pct = rule ? pctOfLimit(rule.spentUsd, rule.limitUsd) : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-bold text-xs uppercase tracking-[0.18em]">
            {period.label}
          </p>
          {rule ? (
            <p
              className={
                overBudget
                  ? 'font-mono text-destructive text-xs'
                  : 'font-mono text-muted-foreground text-xs'
              }
            >
              {formatUsd(rule.spentUsd)} / {formatUsd(rule.limitUsd)}
              {overBudget ? ' · OVER BUDGET' : ''}
              {rule.enabled ? '' : ' · disabled'}
            </p>
          ) : (
            <p className="font-mono text-muted-foreground text-xs">
              No limit set
            </p>
          )}
        </div>
        {rule && (
          <div className="flex items-center gap-2">
            <Button
              className="h-9 border-2 border-foreground px-3 font-bold text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
              disabled={pending}
              onClick={onToggle}
              type="button"
            >
              {rule.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button
              className="h-9 border-2 border-destructive px-3 font-bold text-[11px] text-destructive uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
              disabled={pending}
              onClick={onRemove}
              type="button"
            >
              Remove
            </Button>
          </div>
        )}
      </div>
      {rule && (
        <div aria-hidden className="h-1 w-full bg-muted">
          <div
            className={
              overBudget ? 'h-full bg-destructive' : 'h-full bg-foreground'
            }
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <form className="flex items-center gap-2" onSubmit={onSave}>
        <span className="font-mono text-muted-foreground text-xs">USD</span>
        <input
          aria-label={`${period.label} limit in USD`}
          className="h-9 w-32 border-2 border-foreground bg-background px-2 font-mono text-sm outline-none focus:border-accent"
          inputMode="decimal"
          min="0"
          onChange={(e) => setDraftLimit(e.target.value)}
          placeholder="0.00"
          step="0.01"
          type="number"
          value={draftLimit}
        />
        <Button
          className="h-9 border-2 border-foreground px-3 font-bold text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {rule ? 'Update' : 'Set limit'}
        </Button>
      </form>
    </div>
  )
}
