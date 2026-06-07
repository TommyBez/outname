'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@outname/ui/components/ui/alert-dialog'
import { Button } from '@outname/ui/components/ui/button'

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
          className="h-11 border-2 border-destructive px-4 font-bold text-destructive text-xs uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-destructive-foreground"
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
            You are about to permanently delete <strong>{agentName}</strong> and
            all of its run history and results. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={onDelete}>
            <AlertDialogAction asChild>
              <Button
                className="inline-flex h-10 items-center justify-center bg-destructive px-4 font-semibold text-destructive-foreground text-sm normal-case tracking-normal hover:opacity-90"
                size="sm"
                type="submit"
                variant="destructive"
              >
                Confirm delete
              </Button>
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
