'use client'

import {
  Brain,
  Check,
  FileText,
  FolderOpen,
  Info,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Settings as SettingsIcon,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
import { toast } from 'sonner'
import useSWR, { mutate as swrMutate } from 'swr'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  deleteConversationAction,
  renameConversationAction,
} from '@/lib/agent-chat-actions'
import { cn } from '@/lib/utils'

export interface ConversationSummary {
  id: string
  title: string | null
  updatedAt: string // ISO string — serialisable across the server/client boundary
}

/**
 * Shared SWR key for the sidebar's conversation list. Exported so other
 * client components (notably `AgentChat`) can `mutate` it after a new
 * turn completes, without needing to know the URL shape.
 */
export function conversationsSwrKey(agentId: string) {
  return `/api/agents/${agentId}/conversations`
}

/** Revalidate the sidebar list for a given agent from anywhere in the tree. */
export function revalidateConversations(agentId: string) {
  return swrMutate(conversationsSwrKey(agentId))
}

async function fetchConversations(url: string): Promise<ConversationSummary[]> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to load conversations (${res.status})`)
  }
  const data = (await res.json()) as { conversations: ConversationSummary[] }
  return data.conversations
}

interface AgentSidebarWorkspaceProps {
  agentId: string
  /** Display name of the agent — used as the group label at the top of
   * the workspace section. */
  agentName: string
  /** Server-rendered initial list. Used as `fallbackData` so the list
   * paints instantly and never flashes empty. SWR keeps it in sync
   * client-side. Only supplied for chat-capable kinds. */
  conversations: ConversationSummary[]
  /** Whether the agent is currently enabled. Drives the live status dot
   * rendered next to the name. */
  enabled: boolean
  /** Whether the agent's runtime exposes chat. Non-chat kinds get a
   * slimmer workspace section (name + Configure shortcut, no list). */
  isChatCapable: boolean
}

/**
 * Contextual sidebar section shown while the user is inside an agent
 * workspace. Lives as a `<SidebarGroup>` beneath the global nav so the
 * app keeps a single sidebar on every surface.
 *
 * For chat-capable agents this is the primary way to switch
 * conversations; for other kinds it surfaces the agent name, live
 * status, and a shortcut to Configure.
 */
export function AgentSidebarWorkspace({
  agentId,
  agentName,
  enabled,
  isChatCapable,
  conversations: initialConversations,
}: AgentSidebarWorkspaceProps) {
  const pathname = usePathname()

  // Only register SWR for chat-capable agents. For non-chat kinds the
  // endpoint would 404, and we don't need the list anyway.
  const { data: conversations = initialConversations } = useSWR<
    ConversationSummary[]
  >(isChatCapable ? conversationsSwrKey(agentId) : null, fetchConversations, {
    fallbackData: initialConversations,
    // Cheap catch-up for tabs that have been backgrounded while a
    // turn completed — the only cost is one tiny GET per focus event.
    revalidateOnFocus: true,
  })

  const chatBase = `/agents/${agentId}/chat`
  const isOnChat =
    pathname === chatBase || pathname?.startsWith(`${chatBase}/`) === true

  return (
    // Hide the whole contextual section when the sidebar collapses to
    // icons — the rest of the sidebar (global nav) still renders, and
    // the agent workspace reappears the moment the user expands it.
    <>
      <SidebarGroup className="border-sidebar-border border-t pt-3 group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              'inline-block size-1.5 shrink-0 rounded-full',
              enabled ? 'bg-accent' : 'bg-muted-foreground'
            )}
          />
          <span className="truncate">{agentName}</span>
        </SidebarGroupLabel>

        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === `/agents/${agentId}/about`}
                tooltip="Overview"
              >
                <Link href={`/agents/${agentId}/about`}>
                  <Info aria-hidden />
                  <span>Overview</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === `/agents/${agentId}/edit`}
                tooltip="Configure"
              >
                <Link href={`/agents/${agentId}/edit`}>
                  <SettingsIcon aria-hidden />
                  <span>Configure</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === `/agents/${agentId}/tools`}
                tooltip="Tools"
              >
                <Link href={`/agents/${agentId}/tools`}>
                  <Wrench aria-hidden />
                  <span>Tools</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {isChatCapable && (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isOnChat && pathname === `${chatBase}/new`}
                  tooltip="New chat"
                >
                  <Link href={`/agents/${agentId}/chat/new`}>
                    <MessageSquarePlus aria-hidden />
                    <span>New chat</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {conversations.length === 0 ? (
                <li className="px-2 py-3 text-center font-mono text-[10px] text-muted-foreground/70 uppercase tracking-[0.15em]">
                  No conversations yet
                </li>
              ) : (
                conversations.map((conversation) => (
                  <ConversationRow
                    agentId={agentId}
                    conversation={conversation}
                    isActive={isActive(pathname, agentId, conversation.id)}
                    key={conversation.id}
                  />
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Memory</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === `/agents/${agentId}/timeline`}
                tooltip="Timeline"
              >
                <Link href={`/agents/${agentId}/timeline`}>
                  <FileText aria-hidden />
                  <span>Timeline</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === `/agents/${agentId}/dreams`}
                tooltip="DREAMS"
              >
                <Link href={`/agents/${agentId}/dreams`}>
                  <Brain aria-hidden />
                  <span>DREAMS</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === `/agents/${agentId}/files`}
                tooltip="Files"
              >
                <Link href={`/agents/${agentId}/files`}>
                  <FolderOpen aria-hidden />
                  <span>Files</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}

function isActive(
  pathname: string | null,
  agentId: string,
  conversationId: string
) {
  if (!pathname) {
    return false
  }
  return pathname === `/agents/${agentId}/chat/${conversationId}`
}

interface ConversationRowProps {
  agentId: string
  conversation: ConversationSummary
  isActive: boolean
}

/**
 * A single conversation row. Has two UI modes:
 *   - default: a `<Link>` (so Next.js prefetches) with an overflow menu
 *   - editing: an inline text input that submits via the rename action
 *
 * The delete flow lives in an `AlertDialog` rendered alongside the row
 * so its trigger can fire from inside the dropdown menu (Radix doesn't
 * allow stacking both triggers on the same element).
 */
function ConversationRow({
  agentId,
  conversation,
  isActive,
}: ConversationRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isRenaming, startRenameTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [showDelete, setShowDelete] = useState(false)
  const [draftTitle, setDraftTitle] = useState(conversation.title ?? '')
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Refocus the input whenever we enter edit mode so keyboard flows
  // feel natural (click "Rename" → start typing immediately).
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  // Keep draft in sync if the server pushes a fresh title (e.g. the LLM
  // just generated one after the first turn).
  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(conversation.title ?? '')
    }
  }, [conversation.title, isEditing])

  const displayTitle = conversation.title?.trim() || 'New chat'

  function submitRename(event?: FormEvent) {
    event?.preventDefault()
    const trimmed = draftTitle.trim()
    if (!trimmed) {
      toast.error('Title cannot be empty.')
      return
    }
    if (trimmed === (conversation.title ?? '')) {
      setIsEditing(false)
      return
    }
    startRenameTransition(async () => {
      const result = await renameConversationAction({
        agentId,
        conversationId: conversation.id,
        title: trimmed,
      })
      if (!result.ok) {
        toast.error(result.error ?? 'Could not rename conversation.')
        return
      }
      setIsEditing(false)
      await revalidateConversations(agentId)
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setIsEditing(false)
      setDraftTitle(conversation.title ?? '')
    }
  }

  function confirmDelete() {
    startDeleteTransition(async () => {
      const result = await deleteConversationAction({
        agentId,
        conversationId: conversation.id,
        wasActive: isActive,
      })
      if (!result?.ok) {
        toast.error(result?.error ?? 'Could not delete conversation.')
        return
      }
      toast.success('Conversation deleted.')
      setShowDelete(false)
      await revalidateConversations(agentId)
    })
  }

  if (isEditing) {
    return (
      <SidebarMenuItem>
        <form
          className={cn(
            'flex items-center gap-1 border-2 border-sidebar-border bg-sidebar-accent px-2 py-1.5',
            isActive && 'border-foreground'
          )}
          onSubmit={submitRename}
        >
          <input
            aria-label="Conversation title"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
            disabled={isRenaming}
            maxLength={80}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Conversation title"
            ref={inputRef}
            value={draftTitle}
          />
          <button
            aria-label="Save title"
            className="border border-transparent p-1 text-muted-foreground transition-colors hover:border-sidebar-border hover:bg-sidebar-accent hover:text-foreground disabled:opacity-50"
            disabled={isRenaming}
            type="submit"
          >
            <Check className="size-3.5" />
          </button>
          <button
            aria-label="Cancel rename"
            className="border border-transparent p-1 text-muted-foreground transition-colors hover:border-sidebar-border hover:bg-sidebar-accent hover:text-foreground disabled:opacity-50"
            disabled={isRenaming}
            onClick={() => {
              setIsEditing(false)
              setDraftTitle(conversation.title ?? '')
            }}
            type="button"
          >
            <X className="size-3.5" />
          </button>
        </form>
      </SidebarMenuItem>
    )
  }

  return (
    <>
      <SidebarMenuItem className={cn(isDeleting && 'opacity-50')}>
        <SidebarMenuButton asChild isActive={isActive} tooltip={displayTitle}>
          <Link
            aria-current={isActive ? 'page' : undefined}
            href={`/agents/${agentId}/chat/${conversation.id}`}
          >
            <span className="min-w-0 flex-1 truncate">{displayTitle}</span>
          </Link>
        </SidebarMenuButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              aria-label={`More options for ${displayTitle}`}
              showOnHover
            >
              <MoreHorizontal />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                setIsEditing(true)
              }}
            >
              <Pencil className="mr-2 size-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                setShowDelete(true)
              }}
              variant="destructive"
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <AlertDialog onOpenChange={setShowDelete} open={showDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{displayTitle}&quot; and all of its messages will be
              permanently removed. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                confirmDelete()
              }}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
