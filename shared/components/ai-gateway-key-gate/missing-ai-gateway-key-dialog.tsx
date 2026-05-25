'use client'

import Link from 'next/link'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const VERCEL_AI_GATEWAY_URL = 'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai'

interface MissingAiGatewayKeyDialogProps {
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function MissingAiGatewayKeyDialog({
  open,
  onOpenChange,
}: MissingAiGatewayKeyDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>AI Gateway API key required</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
              <p>
                Creating agents, chatting, editing via AI, and manual runs all
                route through your personal Vercel AI Gateway key (BYOK). Add
                your key in Settings before continuing.
              </p>
              <p>
                Create a key in the{' '}
                <a
                  className="font-semibold text-foreground underline underline-offset-2"
                  href={VERCEL_AI_GATEWAY_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Vercel AI Gateway dashboard
                </a>
                , then paste it under Settings / AI Gateway (BYOK).
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Link href="/settings#ai-gateway">Open settings</Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
