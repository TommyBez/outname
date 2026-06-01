'use client'

import { composabilityStages } from '@outname/shared/marketing/data/composability-demo'
import { AgentShellCard } from './agent-shell-card'
import { FlyingChip } from './flying-chip'
import { partSnapProgress } from './utils'

export function AssemblyVisual({
  progress,
  slotCounts,
}: {
  progress: number
  slotCounts: readonly number[]
}) {
  return (
    <div className="relative h-full min-h-144 w-full">
      <div
        aria-hidden
        className="swiss-diagonal pointer-events-none absolute inset-0 opacity-40"
      />

      <div className="absolute inset-0">
        {composabilityStages.map((stage) =>
          stage.parts.map((part, partIndex) => (
            <FlyingChip
              corner={stage.corner}
              indexInCluster={partIndex}
              key={part.id}
              part={part}
              snap={partSnapProgress(part.id, progress)}
              stageColor={stage.id === 'memory' ? 'accent' : 'background'}
              total={stage.parts.length}
            />
          ))
        )}
      </div>

      <div className="absolute inset-0 grid place-items-center">
        <AgentShellCard slotCounts={slotCounts} />
      </div>
    </div>
  )
}
