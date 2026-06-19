'use client'

import {
  inviteUserToApplicationAction,
  type WaitlistAdminActionResult,
} from '@outname/shared/waitlist/server/actions'
import { Button } from '@outname/ui/components/ui/button'
import { Spinner } from '@outname/ui/components/ui/spinner'
import { unstable_rethrow, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

function getActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'The invite could not be sent.'
}

export function InviteUserForm() {
  const { refresh } = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [isPending, startTransition] = useTransition()

  function runInvite(request: () => Promise<WaitlistAdminActionResult>) {
    startTransition(async () => {
      try {
        const result = await request()
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success('Invite sent.')
        setEmail('')
        setName('')
        refresh()
      } catch (error) {
        unstable_rethrow(error)
        toast.error(getActionErrorMessage(error))
      }
    })
  }

  function submitInvite() {
    runInvite(() => inviteUserToApplicationAction(email, name))
  }

  return (
    <form
      action={submitInvite}
      className="grid gap-4 border-border border-t pt-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
    >
      <label className="flex flex-col gap-2">
        <span className="font-bold text-muted-foreground text-xs uppercase tracking-wider">
          Email
        </span>
        <input
          aria-label="Invitee email"
          autoComplete="email"
          className="h-11 border border-border bg-background px-3 text-sm"
          disabled={isPending}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="user@example.com"
          required
          type="email"
          value={email}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-bold text-muted-foreground text-xs uppercase tracking-wider">
          Name (optional)
        </span>
        <input
          aria-label="Invitee name"
          autoComplete="name"
          className="h-11 border border-border bg-background px-3 text-sm"
          disabled={isPending}
          name="name"
          onChange={(event) => setName(event.target.value)}
          placeholder="How they sign in"
          type="text"
          value={name}
        />
      </label>

      <div className="flex items-end">
        <Button className="w-full md:w-auto" disabled={isPending} type="submit">
          {isPending ? <Spinner className="size-3" /> : null}
          {isPending ? 'Sending…' : 'Send invite'}
        </Button>
      </div>
    </form>
  )
}
