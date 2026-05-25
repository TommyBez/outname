'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AgentLimitReachedDialogProps {
  agentCount: number
  agentLimit: number
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function AgentLimitReachedDialog({
  open,
  onOpenChange,
  agentLimit,
  agentCount,
}: AgentLimitReachedDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="rounded-none border-2 border-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black font-serif text-2xl uppercase tracking-tighter">
            Agent limit reached
          </DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed">
            You can create up to {agentLimit} agents on your account. You
            currently have {agentCount}. Delete an existing agent to free a slot
            before creating another one.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            className="rounded-none border-2 border-foreground font-bold text-xs uppercase tracking-[0.14em]"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Close
          </Button>
          <Button
            asChild
            className="rounded-none border-2 border-foreground bg-foreground font-bold text-background text-xs uppercase tracking-[0.14em] hover:bg-accent hover:text-foreground"
          >
            <Link href="/agents">View agents</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
