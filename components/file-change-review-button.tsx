'use client'

import { useOptimistic, useTransition } from 'react'
import { markFileChangeReviewedAction } from '@/lib/agent-file-changes-actions'
import { Button } from './ui/button'

export function FileChangeReviewButton({
  changeId,
  reviewed,
}: {
  changeId: string
  reviewed: boolean
}) {
  const [optimisticReviewed, setOptimisticReviewed] = useOptimistic(
    reviewed,
    (_current, next: boolean) => next
  )
  const [isPending, startTransition] = useTransition()

  if (optimisticReviewed) {
    return (
      <span className="border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
        Reviewed
      </span>
    )
  }

  return (
    <Button
      aria-label="Mark file change reviewed"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          setOptimisticReviewed(true)
          const result = await markFileChangeReviewedAction(changeId)
          if (!result.ok) {
            setOptimisticReviewed(false)
          }
        })
      }}
      size="xs"
      type="button"
      variant="outline"
    >
      Mark reviewed
    </Button>
  )
}
