import type { BudgetSummaryEntry } from '@outname/shared/budgets/server/types'
import Link from 'next/link'

const PERIOD_LABEL: Record<BudgetSummaryEntry['period'], string> = {
  daily: 'Day',
  weekly: 'Week',
  monthly: 'Month',
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

function barFill(disabled: boolean, overBudget: boolean): string {
  if (disabled) {
    return 'bg-muted-foreground/40'
  }
  if (overBudget) {
    return 'bg-destructive'
  }
  return 'bg-foreground'
}

interface Props {
  /**
   * Where the "Set up budgets" link points when no rule is configured.
   * Defaults to `/settings` for the general variant.
   */
  emptyHref?: string
  emptyLabel?: string
  entries: BudgetSummaryEntry[]
  /**
   * Variant controls density: `general` is the dashboard header strip,
   * `agent` is the compact meter shown inside an agent card.
   */
  variant: 'general' | 'agent'
}

export function BudgetIndicator({
  emptyHref,
  emptyLabel,
  entries,
  variant,
}: Props) {
  if (entries.length === 0) {
    if (!emptyHref) {
      return null
    }
    return (
      <Link
        className="inline-flex items-center gap-2 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em] hover:text-foreground"
        href={emptyHref}
      >
        {emptyLabel ?? 'Set up budgets →'}
      </Link>
    )
  }
  if (variant === 'general') {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {entries.map((entry) => (
          <BudgetMeter entry={entry} key={entry.period} variant="general" />
        ))}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-3">
      {entries.map((entry) => (
        <BudgetMeter entry={entry} key={entry.period} variant="agent" />
      ))}
    </div>
  )
}

function BudgetMeter({
  entry,
  variant,
}: {
  entry: BudgetSummaryEntry
  variant: 'general' | 'agent'
}) {
  const overBudget = entry.spentUsd >= entry.limitUsd
  const disabled = !entry.enabled
  const pct = pctOfLimit(entry.spentUsd, entry.limitUsd)
  const label = PERIOD_LABEL[entry.period]

  if (variant === 'agent') {
    return (
      <div className="flex min-w-[7rem] flex-col gap-1">
        <p className="font-bold text-[9px] text-muted-foreground uppercase tracking-[0.18em]">
          {label}
        </p>
        <p
          className={
            overBudget && !disabled
              ? 'font-mono text-[11px] text-destructive'
              : 'font-mono text-[11px]'
          }
        >
          {formatUsd(entry.spentUsd)} / {formatUsd(entry.limitUsd)}
          {disabled ? ' · off' : ''}
        </p>
        <div aria-hidden className="h-0.5 w-full bg-muted">
          <div
            className={`h-full ${barFill(disabled, overBudget)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="border-border border-l pl-4">
      <p className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
        {label}
        {disabled ? ' · off' : ''}
      </p>
      <p
        className={
          overBudget && !disabled
            ? 'mt-2 font-black font-serif text-2xl text-destructive leading-none tracking-tighter'
            : 'mt-2 font-black font-serif text-2xl leading-none tracking-tighter'
        }
      >
        {formatUsd(entry.spentUsd)}
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        of {formatUsd(entry.limitUsd)}
        {overBudget && !disabled ? ' · OVER' : ''}
      </p>
      <div aria-hidden className="mt-2 h-1 w-full bg-muted">
        <div
          className={`h-full ${barFill(disabled, overBudget)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
