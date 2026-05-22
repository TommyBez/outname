'use client'

import { unstable_rethrow, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  inviteUserToApplicationAction,
  type WaitlistAdminActionResult,
} from '@/waitlist/server/actions'

function getActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'The invite could not be sent.'
}

export function InviteUserForm() {
  const router = useRouter()
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
        router.refresh()
      } catch (error) {
        unstable_rethrow(error)
        toast.error(getActionErrorMessage(error))
      }
    })
  }

  return (
    <form
      className="grid gap-4 border-foreground border-t-2 pt-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
      onSubmit={(event) => {
        event.preventDefault()
        runInvite(() => inviteUserToApplicationAction(email, name))
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="font-bold text-muted-foreground text-xs uppercase tracking-wider">
          Email
        </span>
        <input
          autoComplete="email"
          className="h-11 border-2 border-foreground bg-background px-3 text-sm"
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
          autoComplete="name"
          className="h-11 border-2 border-foreground bg-background px-3 text-sm"
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
