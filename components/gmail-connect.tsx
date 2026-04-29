'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

interface Props {
  connection: {
    email: string
    status: string
    scopes: string
    connectedAt: string
    lastError: string | null
  } | null
}

export function GmailConnect({ connection }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function disconnect() {
    setBusy(true)
    try {
      const res = await fetch('/api/google/disconnect', { method: 'POST' })
      if (!res.ok) {
        throw new Error('Could not disconnect. Please try again.')
      }
      toast.success('Gmail disconnected')
      setConfirming(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not disconnect.')
    } finally {
      setBusy(false)
    }
  }

  if (!connection) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="font-bold text-muted-foreground text-xs uppercase tracking-[0.2em]">
            Not connected
          </p>
          <p className="mt-2 font-black font-serif text-xl uppercase leading-none tracking-[-0.04em]">
            The agent needs read-only access to your inbox.
          </p>
        </div>
        <div>
          <Button asChild>
            <a href="/api/google/connect">Connect Gmail</a>
          </Button>
        </div>
      </div>
    )
  }

  const expired = connection.status !== 'active'

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`inline-block size-2 ${expired ? 'bg-destructive' : 'bg-foreground'}`}
          />
          <p
            className={`font-bold text-xs uppercase tracking-[0.2em] ${
              expired ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {expired ? 'Needs attention' : 'Connected'}
          </p>
        </div>
        <p className="mt-2 font-black font-serif text-xl uppercase leading-none tracking-[-0.04em]">
          {connection.email}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          Linked {new Date(connection.connectedAt).toLocaleDateString()}
        </p>
        {expired && connection.lastError ? (
          <pre className="mt-3 max-h-32 overflow-auto border-2 border-border bg-muted p-3 font-mono text-muted-foreground text-xs">
            {connection.lastError}
          </pre>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {expired ? (
          <Button asChild size="sm">
            <a href="/api/google/connect">Reconnect</a>
          </Button>
        ) : null}
        {confirming ? (
          <fieldset
            aria-label="Confirm disconnect"
            className="flex min-w-0 flex-wrap items-center gap-4 border-0 p-0"
          >
            <button
              className="text-destructive text-sm underline underline-offset-4 transition-colors hover:text-destructive/80 disabled:opacity-50"
              disabled={busy}
              onClick={disconnect}
              type="button"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-3.5" />
                  Disconnecting…
                </span>
              ) : (
                'Confirm disconnect'
              )}
            </button>
            <button
              className="text-muted-foreground text-sm transition-colors hover:text-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() => setConfirming(false)}
              type="button"
            >
              Cancel
            </button>
          </fieldset>
        ) : (
          <button
            className="text-muted-foreground text-sm underline-offset-4 transition-colors hover:text-foreground hover:underline"
            onClick={() => setConfirming(true)}
            type="button"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  )
}
