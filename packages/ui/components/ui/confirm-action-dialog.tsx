'use client'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@outname/ui/components/ui/alert-dialog'
import { Button } from '@outname/ui/components/ui/button'
import { Spinner } from '@outname/ui/components/ui/spinner'
import { type ReactNode, useState, useTransition } from 'react'
import { toast } from 'sonner'

interface ConfirmActionDialogProps {
  cancelLabel?: string
  confirmLabel: string
  description: ReactNode
  destructive?: boolean
  /**
   * Runs when the user confirms. The dialog stays open with a pending
   * indicator until the promise settles; rejections surface as an error toast
   * so no destructive action fails silently.
   */
  onConfirm: () => Promise<void> | void
  title: string
  trigger: ReactNode
}

export function ConfirmActionDialog({
  cancelLabel = 'Cancel',
  confirmLabel,
  description,
  destructive = true,
  onConfirm,
  title,
  trigger,
}: ConfirmActionDialogProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      try {
        await onConfirm()
        setOpen(false)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Something went wrong'
        )
      }
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    if (pending) {
      return
    }
    setOpen(nextOpen)
  }

  return (
    <AlertDialog onOpenChange={handleOpenChange} open={open}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button
            className={
              destructive
                ? 'inline-flex h-10 items-center justify-center gap-2 bg-destructive px-4 font-semibold text-destructive-foreground text-sm hover:opacity-90'
                : 'inline-flex h-10 items-center justify-center gap-2 px-4 font-semibold text-sm'
            }
            disabled={pending}
            onClick={handleConfirm}
            size="sm"
            type="button"
            variant={destructive ? 'destructive' : 'default'}
          >
            {pending ? <Spinner /> : null}
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
