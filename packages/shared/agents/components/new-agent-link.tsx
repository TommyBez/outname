'use client'

import { AGENT_CREATION_LIMIT_MESSAGE } from '@outname/shared/agents/creation-limits'
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
import Link from 'next/link'
import type { ReactNode } from 'react'

interface NewAgentLinkProps {
  canCreate: boolean
  children: ReactNode
  className: string
}

export function NewAgentLink({
  canCreate,
  children,
  className,
}: NewAgentLinkProps) {
  if (canCreate) {
    return (
      <Link className={className} href="/agents/new">
        {children}
      </Link>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className={className} type="button" variant="outline">
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Agent limit reached</AlertDialogTitle>
          <AlertDialogDescription>
            {AGENT_CREATION_LIMIT_MESSAGE} Delete an existing agent before
            creating another.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Link href="/agents">Manage agents</Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
