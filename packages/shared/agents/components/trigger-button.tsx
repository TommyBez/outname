'use client'

import { Button } from '@outname/ui/components/ui/button'
import { Spinner } from '@outname/ui/components/ui/spinner'
import { cn } from '@outname/ui/lib/utils'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

/**
 * Triggers a manual run for a specific agent. `agentId` is required; there
 * is no implicit "default agent" since this is a multi-agent platform.
 */
export function TriggerButton({
  agentId,
  variant = 'default',
  label = 'Run now',
  mode = 'heartbeat',
  className,
}: {
  agentId: string
  variant?: 'default' | 'outline' | 'link'
  label?: string
  mode?: 'heartbeat' | 'dreaming'
  className?: string
}) {
  const { push, refresh } = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function trigger() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/trigger`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const { eventId, workflowRunId } = (await res.json()) as {
        eventId?: string
        workflowRunId?: string
      }
      toast.success(
        mode === 'dreaming' ? 'Dreaming started' : 'Run started',
        (workflowRunId ?? eventId)
          ? { description: `Event ${(workflowRunId ?? eventId)?.slice(0, 8)}` }
          : undefined
      )
      startTransition(() => {
        if (eventId) {
          push(`/agents/${agentId}/events?event=${eventId}`)
          return
        }
        refresh()
      })
    } catch (err) {
      toast.error(
        mode === 'dreaming'
          ? 'Could not start dreaming'
          : 'Could not start run',
        {
          description: err instanceof Error ? err.message : 'Unknown error',
        }
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (variant === 'link') {
    return (
      <Button
        className={cn(
          'h-auto border-0 bg-transparent p-0 font-normal text-muted-foreground text-sm normal-case tracking-normal transition-colors hover:bg-transparent hover:text-foreground disabled:opacity-50',
          className
        )}
        disabled={isLoading || isPending}
        onClick={trigger}
        size="xs"
        type="button"
        variant="ghost"
      >
        {isLoading ? 'Starting…' : label}
      </Button>
    )
  }

  return (
    <Button
      className={cn('font-medium', className)}
      disabled={isLoading || isPending}
      onClick={trigger}
      size="sm"
      variant={variant}
    >
      {isLoading ? <Spinner className="mr-1 size-3.5" /> : null}
      {isLoading ? 'Starting…' : label}
    </Button>
  )
}
