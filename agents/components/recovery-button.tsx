'use client'

import { RefreshCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

type RecoveryMode = 'safe' | 'force'

interface RecoveryResponse {
  error?: string
  result?: {
    reason?: string
    sessionEpoch?: number | null
    sessionRunId?: string | null
  }
}

export function RecoveryButton({
  agentId,
  className,
  disabled = false,
  variant = 'outline',
}: {
  agentId: string
  className?: string
  disabled?: boolean
  variant?: 'default' | 'outline' | 'secondary'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loadingMode, setLoadingMode] = useState<RecoveryMode | null>(null)
  const [isPending, startTransition] = useTransition()

  async function recover(mode: RecoveryMode) {
    setLoadingMode(mode)
    try {
      const res = await fetch(`/api/agents/${agentId}/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const body = (await res.json().catch(() => ({}))) as RecoveryResponse

      if (!res.ok) {
        throw new RecoveryRequestError(
          body.error ?? `HTTP ${res.status}`,
          res.status,
          body.result?.reason
        )
      }

      const sessionRunId = body.result?.sessionRunId
      const sessionEpoch = body.result?.sessionEpoch
      toast.success('Session recovered', {
        description: [
          sessionEpoch == null ? null : `Epoch ${sessionEpoch}`,
          sessionRunId ? `Session ${sessionRunId.slice(0, 8)}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      })
      setOpen(false)
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error('Could not recover session', {
        description: recoveryErrorDescription(err),
      })
    } finally {
      setLoadingMode(null)
    }
  }

  const busy = loadingMode !== null || isPending

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        <Button
          className={cn('font-medium', className)}
          disabled={disabled || busy}
          size="sm"
          variant={variant}
        >
          <RefreshCcw />
          Recover
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recover session?</AlertDialogTitle>
          <AlertDialogDescription>
            Safe restart waits for the current workflow to stop. Force restart
            abandons the current workflow event and starts a new session epoch.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            disabled={busy}
            onClick={() => recover('force')}
            type="button"
            variant="destructive"
          >
            {loadingMode === 'force' ? <Spinner className="size-3.5" /> : null}
            Force restart
          </Button>
          <Button disabled={busy} onClick={() => recover('safe')} type="button">
            {loadingMode === 'safe' ? <Spinner className="size-3.5" /> : null}
            Safe restart
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

class RecoveryRequestError extends Error {
  reason?: string
  status: number

  constructor(message: string, status: number, reason?: string) {
    super(message)
    this.name = 'RecoveryRequestError'
    this.reason = reason
    this.status = status
  }
}

function recoveryErrorDescription(err: unknown): string {
  if (!(err instanceof RecoveryRequestError)) {
    return err instanceof Error ? err.message : 'Unknown error'
  }

  if (err.status === 412) {
    return 'Enable the agent before recovering its session.'
  }

  if (err.status === 409 && err.reason === 'session_cancel_timeout') {
    return 'Safe restart timed out. Use force restart if the session is stuck.'
  }

  if (err.status === 409) {
    return 'Recovery is already running for this agent.'
  }

  return err.message
}
