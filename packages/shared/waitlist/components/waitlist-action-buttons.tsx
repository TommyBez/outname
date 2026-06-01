'use client'

import type { WaitlistEntry } from '@outname/db/schema'
import {
  resendWaitlistConfirmationAction,
  sendWaitlistInviteAction,
  updateWaitlistStatusAction,
  type WaitlistAdminActionResult,
} from '@outname/shared/waitlist/server/actions'
import { Button } from '@outname/ui/components/ui/button'
import { Spinner } from '@outname/ui/components/ui/spinner'
import { unstable_rethrow, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type WaitlistActionKind =
  | 'converted'
  | 'invite'
  | 'resend-confirmation'
  | 'unsubscribe'

const pendingLabels: Record<WaitlistActionKind, string> = {
  converted: 'Saving…',
  invite: 'Sending…',
  'resend-confirmation': 'Sending…',
  unsubscribe: 'Saving…',
}

function getActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'The waitlist action failed.'
}

interface ActionButtonProps {
  action: WaitlistActionKind
  children: string
  disabled: boolean
  onClick: () => void
  pendingAction: WaitlistActionKind | null
  variant?: 'default' | 'ghost' | 'outline' | 'secondary'
}

function ActionButton({
  action,
  children,
  disabled,
  onClick,
  pendingAction,
  variant = 'default',
}: ActionButtonProps) {
  const isLoading = pendingAction === action

  return (
    <Button
      disabled={disabled}
      onClick={onClick}
      size="xs"
      type="button"
      variant={variant}
    >
      {isLoading ? <Spinner className="size-3" /> : null}
      {isLoading ? pendingLabels[action] : children}
    </Button>
  )
}

export function WaitlistActionButtons({ entry }: { entry: WaitlistEntry }) {
  const { refresh } = useRouter()
  const [pendingAction, setPendingAction] = useState<WaitlistActionKind | null>(
    null
  )
  const [isPending, startTransition] = useTransition()

  function runAction(
    action: WaitlistActionKind,
    request: () => Promise<WaitlistAdminActionResult>
  ) {
    setPendingAction(action)
    startTransition(async () => {
      try {
        const result = await request()
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        refresh()
      } catch (error) {
        unstable_rethrow(error)
        toast.error(getActionErrorMessage(error))
      } finally {
        setPendingAction(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {entry.status === 'pending' ? (
        <ActionButton
          action="resend-confirmation"
          disabled={isPending}
          onClick={() =>
            runAction('resend-confirmation', () =>
              resendWaitlistConfirmationAction(entry.id)
            )
          }
          pendingAction={pendingAction}
          variant="outline"
        >
          Resend confirm
        </ActionButton>
      ) : null}

      {entry.status === 'confirmed' || entry.status === 'invited' ? (
        <ActionButton
          action="invite"
          disabled={isPending}
          onClick={() =>
            runAction('invite', () => sendWaitlistInviteAction(entry.id))
          }
          pendingAction={pendingAction}
        >
          {entry.status === 'invited' ? 'Resend access' : 'Grant access'}
        </ActionButton>
      ) : null}

      {entry.status === 'converted' ? null : (
        <ActionButton
          action="converted"
          disabled={isPending}
          onClick={() =>
            runAction('converted', () =>
              updateWaitlistStatusAction(entry.id, 'converted')
            )
          }
          pendingAction={pendingAction}
          variant="secondary"
        >
          Mark converted
        </ActionButton>
      )}

      {entry.status === 'unsubscribed' ? null : (
        <ActionButton
          action="unsubscribe"
          disabled={isPending}
          onClick={() =>
            runAction('unsubscribe', () =>
              updateWaitlistStatusAction(entry.id, 'unsubscribed')
            )
          }
          pendingAction={pendingAction}
          variant="ghost"
        >
          Unsubscribe
        </ActionButton>
      )}
    </div>
  )
}
