'use client'

import { setAgentEnabledAction } from '@outname/shared/agents/server/actions'
import { Spinner } from '@outname/ui/components/ui/spinner'
import { Pause, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

interface AgentEnabledToggleProps {
  agentId: string
  agentName: string
  enabled: boolean
}

export function AgentEnabledToggle({
  agentId,
  agentName,
  enabled,
}: AgentEnabledToggleProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      try {
        await setAgentEnabledAction({ agentId, enabled: !enabled })
        toast.success(
          enabled
            ? `${agentName} paused. It will ignore new events until resumed.`
            : `${agentName} resumed. It is ready to receive events.`
        )
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not update agent state'
        )
      }
    })
  }

  const stateIcon = enabled ? (
    <Pause aria-hidden className="size-3.5" />
  ) : (
    <Play aria-hidden className="size-3.5" />
  )

  // No aria-pressed: the accessible name already flips between "Pause agent"
  // and "Resume agent", and combining a changing label with aria-pressed
  // gives contradictory announcements.
  return (
    <button
      className="inline-flex h-10 items-center justify-center gap-2 border-2 border-foreground px-4 font-bold text-[10px] uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      onClick={handleToggle}
      type="button"
    >
      {pending ? <Spinner className="size-3.5" /> : stateIcon}
      {enabled ? 'Pause agent' : 'Resume agent'}
    </button>
  )
}
