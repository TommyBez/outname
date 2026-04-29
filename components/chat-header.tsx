'use client'

import {
  ChevronRight,
  Info,
  MoreHorizontal,
  Play,
  Settings as SettingsIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
 * ("Agents › {name}") and a single kebab for About / Configure / Trigger,
 * so the chat pane itself is unclutted and the composer stays close to
 * the viewport bottom.
 *
 * Rendered inside `<ChatFrame>`, which is itself inside the AppShell's
 * padded main column.
 */
export function ChatHeader({ agentId, agentName, enabled }: ChatHeaderProps) {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isTriggering, setIsTriggering] = useState(false)
  const [, startTransition] = useTransition()

  async function handleTriggerNow() {
    // Close the menu immediately so the user gets feedback on the
    // action even while the network call is in flight.
    setIsMenuOpen(false)
    setIsTriggering(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/trigger`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const { runId } = (await res.json()) as { runId: string }
      toast.success('Run started', {
        description: `ID ${runId.slice(0, 8)}`,
      })
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error('Could not start run', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setIsTriggering(false)
    }
  }

  return (
    <header className="flex items-center justify-between gap-3 border-border border-b pb-4">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
        <Link
          className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em] transition-colors hover:text-foreground"
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
              'inline-block size-1.5 shrink-0 rounded-full',
              enabled ? 'bg-accent' : 'bg-muted-foreground'
            )}
          />
          <h1 className="min-w-0 truncate font-medium font-serif text-base tracking-tight sm:text-lg">
            {agentName}
          </h1>
          <span
            aria-label={enabled ? 'active' : 'paused'}
            className="hidden font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] sm:inline"
          >
            · {enabled ? 'active' : 'paused'}
          </span>
        </div>
      </nav>

      <DropdownMenu onOpenChange={setIsMenuOpen} open={isMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Agent actions"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
            type="button"
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/agents/${agentId}/about`}>
              <Info className="mr-2 size-3.5" />
              About
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/agents/${agentId}/edit`}>
              <SettingsIcon className="mr-2 size-3.5" />
              Configure
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isTriggering}
            onSelect={(event) => {
              event.preventDefault()
              void handleTriggerNow()
            }}
          >
            <Play className="mr-2 size-3.5" />
            {isTriggering ? 'Starting…' : 'Trigger now'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
