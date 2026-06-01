'use client'

import {
  removeAiGatewayKeyAction,
  saveAiGatewayKeyAction,
} from '@outname/auth/settings/actions'
import { Button } from '@outname/ui/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

export function AiGatewayKeyCard({ hasKey }: { hasKey: boolean }) {
  const [apiKey, setApiKey] = useState('')
  const [pending, startTransition] = useTransition()
  const { refresh } = useRouter()

  function saveKey() {
    startTransition(async () => {
      const result = await saveAiGatewayKeyAction(apiKey)
      if (!result.ok) {
        toast.error(result.error ?? 'Unable to save key.')
        return
      }
      toast.success('Key saved.')
      setApiKey('')
      refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        Every agent run requires your personal AI Gateway key (BYOK). No
        fallback key is used.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-xs uppercase tracking-[0.16em]">
          Status: {hasKey ? 'Configured' : 'Missing'}
        </span>
      </div>
      <form action={saveKey} className="flex max-w-md flex-col gap-2">
        <input
          aria-label="AI Gateway API key"
          className="h-10 border-2 border-foreground bg-background px-3 font-mono text-sm"
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="vck_..."
          required
          type="password"
          value={apiKey}
        />
        <div className="flex gap-2">
          <Button disabled={pending} size="sm" type="submit" variant="default">
            Save key
          </Button>
          {hasKey ? (
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await removeAiGatewayKeyAction()
                  if (!result.ok) {
                    toast.error('Unable to remove key.')
                    return
                  }
                  toast.success('Key removed.')
                  refresh()
                })
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Remove
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
