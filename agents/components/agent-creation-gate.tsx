'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { AgentLimitReachedDialog } from '@/agents/components/agent-limit-reached-dialog'
import type { AgentCreationLimitState } from '@/agents/shared/agent-limit-types'

interface AgentCreationGateProps {
  children: ReactNode
  limitState: AgentCreationLimitState
}

export function AgentCreationGate({
  children,
  limitState,
}: AgentCreationGateProps) {
  const [dialogOpen, setDialogOpen] = useState(!limitState.canCreate)

  useEffect(() => {
    if (!limitState.canCreate) {
      setDialogOpen(true)
    }
  }, [limitState.canCreate])

  if (!limitState.canCreate) {
    return (
      <>
        <AgentLimitReachedDialog
          agentCount={limitState.count}
          agentLimit={limitState.limit}
          onOpenChange={setDialogOpen}
          open={dialogOpen}
        />
        <div
          aria-hidden
          className="pointer-events-none select-none opacity-40"
          inert
        >
          {children}
        </div>
      </>
    )
  }

  return children
}
