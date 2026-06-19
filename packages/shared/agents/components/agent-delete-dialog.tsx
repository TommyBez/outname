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
import { useFormStatus } from 'react-dom'

interface AgentDeleteDialogProps {
  agentName: string
  onDelete: () => Promise<void>
}

export function AgentDeleteDialog({
  agentName,
  onDelete,
}: AgentDeleteDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          className="h-11 border border-destructive px-4 font-bold text-destructive text-xs transition-colors hover:bg-destructive hover:text-destructive-foreground"
          type="button"
          variant="outline"
        >
          Delete agent
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this agent?</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to permanently delete <strong>{agentName}</strong>,
            including its settings, memory, run history, and sandbox. Pending
            events will be cancelled. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={onDelete}>
          <DeleteDialogFooter />
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeleteDialogFooter() {
  const { pending } = useFormStatus()

  return (
    <AlertDialogFooter>
      <AlertDialogCancel disabled={pending} type="button">
        Cancel
      </AlertDialogCancel>
      <Button
        className="inline-flex h-10 items-center justify-center gap-2 bg-destructive px-4 font-semibold text-destructive-foreground text-sm normal-case tracking-normal hover:opacity-90"
        disabled={pending}
        size="sm"
        type="submit"
        variant="destructive"
      >
        {pending ? <Spinner /> : null}
        {pending ? 'Deleting…' : 'Confirm delete'}
      </Button>
    </AlertDialogFooter>
  )
}
