'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

/**
 * Triggers a manual run for a specific agent. `agentId` is required; there
 * is no implicit "default agent" since this is a multi-agent platform.
 */
export function TriggerButton({
  agentId,
  variant = 'default',
  label = 'Run now',
  className,
}: {
  agentId: string
  variant?: 'default' | 'outline' | 'link'
  label?: string
  className?: string
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function trigger() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/trigger`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const { sessionRunId } = (await res.json()) as { sessionRunId: string }
      toast.success('Run started', {
        description: `Session ${sessionRunId.slice(0, 8)}`,
      })
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error('Could not start run', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
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
