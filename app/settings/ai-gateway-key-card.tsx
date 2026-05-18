'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  removeAiGatewayKeyAction,
  saveAiGatewayKeyAction,
} from '@/app/settings/actions'
import { Button } from '@/components/ui/button'

export function AiGatewayKeyCard({ hasKey }: { hasKey: boolean }) {
  const [apiKey, setApiKey] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

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
      <form
        className="flex max-w-md flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          startTransition(async () => {
            const result = await saveAiGatewayKeyAction(apiKey)
            if (!result.ok) {
              toast.error(result.error ?? 'Unable to save key.')
              return
            }
            toast.success('Key saved.')
            setApiKey('')
            router.refresh()
          })
        }}
      >
        <input
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
                  router.refresh()
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
