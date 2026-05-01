'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { TriggerButton } from '@/components/trigger-button'
import { cn } from '@/lib/utils'

interface ChatHeaderProps {
  agentId: string
  agentName: string
  /** Whether the agent is currently enabled. Drives the status dot
   * and the text next to it ("active" vs "paused"). */
  enabled: boolean
}

/**
 * Compact chat header shown above the active conversation. Replaces the
 * previous three-line agent header + tab strip. Keeps wayfinding
 * ("Agents › {name}") plus a direct Trigger Now action. Persistent
 * workspace links such as About and Configure live in the sidebar.
 *
 * Rendered inside `<ChatFrame>`, which is itself inside the AppShell's
 * padded main column.
 */
export function ChatHeader({ agentId, agentName, enabled }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 border-foreground border-b-2 pb-4">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
        <Link
          className="font-bold text-muted-foreground text-xs uppercase tracking-[0.2em] transition-colors hover:text-accent"
          href="/agents"
        >
          Agents
        </Link>
        <ChevronRight
          aria-hidden
          className="size-3 shrink-0 text-muted-foreground/60"
        />
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={cn(
              'inline-block size-2 shrink-0',
              enabled ? 'bg-accent' : 'bg-muted-foreground'
            )}
          />
          <h1 className="min-w-0 truncate font-black font-serif text-base uppercase tracking-[-0.04em] sm:text-lg">
            {agentName}
          </h1>
          <span
            className="hidden font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] sm:inline"
            title={enabled ? 'active' : 'paused'}
          >
            · {enabled ? 'active' : 'paused'}
          </span>
        </div>
      </nav>

      <TriggerButton agentId={agentId} label="Trigger now" variant="outline" />
    </header>
  )
}
