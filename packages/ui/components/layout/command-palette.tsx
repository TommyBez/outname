'use client'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@outname/ui/components/ui/command'
import { Kbd, KbdGroup } from '@outname/ui/components/ui/kbd'
import {
  Bot,
  LayoutDashboard,
  MessageSquare,
  Plug,
  Plus,
  Search,
  Settings as SettingsIcon,
  Wrench,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

const OPEN_COMMAND_PALETTE_EVENT = 'outname:command-palette:open'
const APPLE_PLATFORM_RE = /Mac|iPhone|iPad/i

export interface CommandPaletteAgent {
  enabled: boolean
  id: string
  name: string
}

const NAVIGATE_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/agents', icon: Bot, label: 'Agents' },
  { href: '/channels', icon: MessageSquare, label: 'Channels' },
  { href: '/connections', icon: Plug, label: 'Connections' },
  { href: '/settings', icon: SettingsIcon, label: 'Settings' },
] as const

export function CommandPalette({ agents }: { agents: CommandPaletteAgent[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    const handleOpenRequest = () => setOpen(true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenRequest)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenRequest)
    }
  }, [])

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  return (
    <CommandDialog
      description="Jump to a page, agent, or action"
      onOpenChange={setOpen}
      open={open}
      title="Command palette"
    >
      <CommandInput placeholder="Search pages, agents, and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAVIGATE_ITEMS.map((item) => (
            <CommandItem
              key={item.href}
              onSelect={() => navigate(item.href)}
              value={`navigate ${item.label}`}
            >
              <item.icon aria-hidden />
              <span>{item.label}</span>
            </CommandItem>
          ))}
          <CommandItem
            onSelect={() => navigate('/agents/new')}
            value="navigate new agent create"
          >
            <Plus aria-hidden />
            <span>New agent</span>
          </CommandItem>
        </CommandGroup>
        {agents.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Agents">
              {agents.map((agent) => (
                <CommandItem
                  key={agent.id}
                  onSelect={() => navigate(`/agents/${agent.id}`)}
                  value={`agent ${agent.name}`}
                >
                  <Bot aria-hidden />
                  <span className="truncate">{agent.name}</span>
                  <span className="ml-auto text-muted-foreground text-xs uppercase">
                    {agent.enabled ? 'Active' : 'Paused'}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Chat">
              {agents.map((agent) => (
                <CommandItem
                  key={agent.id}
                  onSelect={() => navigate(`/agents/${agent.id}/chat/new`)}
                  value={`chat with ${agent.name}`}
                >
                  <MessageSquare aria-hidden />
                  <span className="truncate">Chat with {agent.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Configure">
              {agents.map((agent) => (
                <CommandItem
                  key={agent.id}
                  onSelect={() => navigate(`/agents/${agent.id}/configure`)}
                  value={`configure ${agent.name} settings tools`}
                >
                  <Wrench aria-hidden />
                  <span className="truncate">Configure {agent.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}

export function CommandPaletteTrigger() {
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(APPLE_PLATFORM_RE.test(window.navigator.userAgent))
  }, [])

  return (
    <button
      aria-keyshortcuts="Meta+K"
      className="ml-auto inline-flex h-9 items-center gap-2 border-2 border-foreground px-3 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
      onClick={() => {
        window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))
      }}
      type="button"
    >
      <Search aria-hidden className="size-3.5" />
      <span className="hidden sm:inline">Search</span>
      <KbdGroup>
        <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    </button>
  )
}
