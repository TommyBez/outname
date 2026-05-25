'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { isAiGatewayApiKeyMissingError } from '@/shared/ai-gateway/errors'
import { useAiGatewayKeyGate } from '@/shared/components/ai-gateway-key-gate/ai-gateway-key-gate-provider'

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
  const router = useRouter()
  const { requireAiGatewayKey } = useAiGatewayKeyGate()
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function trigger() {
    setIsLoading(true)
    try {
      await postAgentTrigger({
        agentId,
        mode,
        onMissingKey: requireAiGatewayKey,
        onSuccess: (payload) => {
          const runId = payload.workflowRunId ?? payload.eventId
          toast.success(
            mode === 'dreaming' ? 'Dreaming started' : 'Run started',
            runId ? { description: `Event ${runId.slice(0, 8)}` } : undefined
          )
          startTransition(() => {
            if (payload.eventId) {
              router.push(`/agents/${agentId}/events?event=${payload.eventId}`)
              return
            }
            router.refresh()
          })
        },
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
      <button
        className={cn(
          'text-muted-foreground text-sm transition-colors hover:text-foreground disabled:opacity-50',
          className
        )}
        disabled={isLoading || isPending}
        onClick={trigger}
        type="button"
      >
        {isLoading ? 'Starting…' : label}
      </button>
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

async function postAgentTrigger(input: {
  agentId: string
  mode: 'heartbeat' | 'dreaming'
  onMissingKey: () => boolean
  onSuccess: (payload: { eventId?: string; workflowRunId?: string }) => void
}): Promise<void> {
  if (!input.onMissingKey()) {
    return
  }

  const res = await fetch(`/api/agents/${input.agentId}/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: input.mode }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    if (isAiGatewayApiKeyMissingError(body) && !input.onMissingKey()) {
      return
    }
    throw new Error(
      typeof body.error === 'string' ? body.error : `HTTP ${res.status}`
    )
  }

  const payload = (await res.json()) as {
    eventId?: string
    workflowRunId?: string
  }
  input.onSuccess(payload)
}
