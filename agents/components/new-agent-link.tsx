'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AgentLimitReachedDialog } from '@/agents/components/agent-limit-reached-dialog'
import type { AgentCreationLimitState } from '@/agents/shared/agent-limit-types'
import { cn } from '@/lib/utils'

interface NewAgentLinkProps {
  children: React.ReactNode
  className?: string
  href?: string
  limitState: AgentCreationLimitState
}

export function NewAgentLink({
  href = '/agents/new',
  limitState,
  className,
  children,
}: NewAgentLinkProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  if (limitState.canCreate) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    )
  }

  return (
    <>
      <button
        className={cn(className)}
        onClick={() => setDialogOpen(true)}
        type="button"
      >
        {children}
      </button>
      <AgentLimitReachedDialog
        agentCount={limitState.count}
        agentLimit={limitState.limit}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </>
  )
}
