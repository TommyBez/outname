'use client'

import { composabilityStages } from '@outname/shared/marketing/data/composability-demo'
import { Badge } from '@outname/ui/components/ui/badge'
import { cn } from '@outname/ui/lib/utils'
import { stageIcons } from './constants'

export function AgentShellCard({
  compact = false,
  slotCounts,
}: {
  compact?: boolean
  slotCounts: readonly number[]
}) {
  const allFilled =
    slotCounts.length === composabilityStages.length &&
    slotCounts.every(
      (count, idx) => count === composabilityStages[idx].parts.length
    )

  return (
    <div
      className={cn(
        'relative z-10 w-full border border-border bg-background shadow-foreground/25',
        compact
          ? 'max-w-[18rem] p-1.5 shadow-[6px_6px_0_0] sm:max-w-76'
          : 'max-w-md p-2 shadow-[8px_8px_0_0]'
      )}
    >
      <div
        className={cn(
          'border border-border/15 bg-background',
          compact ? 'p-4' : 'p-5'
        )}
      >
        <div
          className={cn(
            'flex items-start justify-between gap-3 border-border border-b',
            compact ? 'pb-3' : 'pb-4'
          )}
        >
          <div>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-normal">
              Agent
            </p>
            <p
              className={cn(
                'mt-2 font-black uppercase leading-none tracking-normal',
                compact ? 'text-lg' : 'text-2xl'
              )}
            >
              INBOX SENTINEL
            </p>
          </div>
          <Badge
            className={cn(
              compact &&
                'h-auto px-2 py-1 font-mono text-[9px] uppercase tracking-normal'
            )}
            variant="outline"
          >
            {allFilled ? 'composed' : 'incomplete'}
          </Badge>
        </div>

        <div className={cn('mt-4 grid', compact ? 'gap-1.5' : 'gap-2')}>
          {composabilityStages.map((stage, idx) => {
            const count = slotCounts[idx] ?? 0
            const total = stage.parts.length
            const filled = count >= total
            const Icon = stageIcons[stage.id]
            return (
              <div
                className={cn(
                  'grid items-center border border-border transition-colors duration-150',
                  compact
                    ? 'grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-2 px-2.5 py-2'
                    : 'grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-3 px-3 py-3',
                  filled ? 'bg-foreground text-background' : 'bg-muted'
                )}
                key={stage.id}
              >
                <Icon className={compact ? 'size-3.5' : 'size-4'} />
                <p
                  className={cn(
                    'font-black uppercase tracking-normal',
                    compact ? 'text-[11px] leading-tight' : 'text-sm'
                  )}
                >
                  {stage.label}
                </p>
                <p
                  className={cn(
                    'font-mono tabular-nums',
                    compact ? 'text-[10px]' : 'text-xs',
                    filled ? 'text-background/80' : 'text-muted-foreground'
                  )}
                >
                  {count} / {total}
                </p>
              </div>
            )
          })}
        </div>

        <p
          className={cn(
            'border-border border-t font-mono text-muted-foreground uppercase tracking-normal',
            compact ? 'mt-3 pt-2 text-[9px]' : 'mt-4 pt-3 text-[10px]'
          )}
        >
          {allFilled
            ? 'Eight parts. One agent. Yours.'
            : 'Waiting for parts to attach…'}
        </p>
      </div>
    </div>
  )
}
