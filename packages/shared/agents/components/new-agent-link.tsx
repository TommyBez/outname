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
import type { ComponentProps, ReactNode } from 'react'

interface NewAgentLinkProps {
  canCreate: boolean
  children: ReactNode
  className?: string
  size?: ComponentProps<typeof Button>['size']
  variant?: ComponentProps<typeof Button>['variant']
}

export function NewAgentLink({
  canCreate,
  children,
  className,
  size = 'lg',
  variant = 'default',
}: NewAgentLinkProps) {
  if (canCreate) {
    return (
      <Button asChild className={className} size={size} variant={variant}>
        <Link href="/agents/new">{children}</Link>
      </Button>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          className={className}
          size={size}
          type="button"
          variant={variant}
        >
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
