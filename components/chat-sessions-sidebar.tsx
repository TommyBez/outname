"use client"

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import useSWR, { mutate as swrMutate } from "swr"
import { toast } from "sonner"
import {
  Check,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  deleteConversationAction,
  renameConversationAction,
} from "@/lib/agent-chat-actions"
import { cn } from "@/lib/utils"

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
  if (!res.ok) throw new Error(`Failed to load conversations (${res.status})`)
  const data = (await res.json()) as { conversations: ConversationSummary[] }
  return data.conversations
}

interface ChatSessionsSidebarProps {
  agentId: string
  /** Server-rendered initial list. Used as `fallbackData` so the sidebar
   * paints instantly on first load and never flashes empty. SWR then
   * keeps it in sync client-side. */
  conversations: ConversationSummary[]
}

/**
 * Left-column conversation list for the agent chat surface. The list is
 * hydrated from a server-rendered snapshot (`conversations` prop) and
 * then driven entirely by SWR. `AgentChat` calls
 * `revalidateConversations(agentId)` from `onFinish` after each turn,
 * so the sidebar picks up freshly generated titles (and re-ordered
 * threads) without ever re-rendering the active chat pane — this
 * replaces the old `router.refresh()` approach that was racing with
 * Next 16's cache-components + the streaming `useChat` state.
 *
 * Responsive behaviour: on `md` and up the sidebar sits in its own grid
 * column and scrolls independently. Below `md` the chat layout stacks
 * so the sidebar appears above the pane with a capped height — scroll
 * to browse, tap to switch.
 */
export function ChatSessionsSidebar({
  agentId,
  conversations: initialConversations,
}: ChatSessionsSidebarProps) {
  const pathname = usePathname()
  const { data: conversations = initialConversations } = useSWR<
    ConversationSummary[]
  >(conversationsSwrKey(agentId), fetchConversations, {
    fallbackData: initialConversations,
    // Cheap catch-up for tabs that have been backgrounded while a turn
    // completed — the only cost is one tiny GET per focus event.
    revalidateOnFocus: true,
  })

  return (
    <aside className="flex flex-col gap-3 md:sticky md:top-6 md:max-h-[calc(100vh-4rem)]">
      <Link
        href={`/agents/${agentId}/chat/new`}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        <MessageSquarePlus className="size-4" aria-hidden />
        New chat
      </Link>

      {conversations.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          No conversations yet. Start one with the button above.
        </p>
      ) : (
        <nav
          aria-label="Conversations"
          className="flex max-h-64 flex-col gap-0.5 overflow-y-auto md:max-h-none"
        >
          {conversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              agentId={agentId}
              conversation={conversation}
              isActive={isActive(pathname, agentId, conversation.id)}
            />
          ))}
        </nav>
      )}
    </aside>
  )
}

function isActive(
  pathname: string | null,
  agentId: string,
  conversationId: string,
) {
  if (!pathname) return false
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
  const [draftTitle, setDraftTitle] = useState(conversation.title ?? "")
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
    if (!isEditing) setDraftTitle(conversation.title ?? "")
  }, [conversation.title, isEditing])

  const displayTitle = conversation.title?.trim() || "New chat"

  function submitRename(event?: FormEvent) {
    event?.preventDefault()
    const trimmed = draftTitle.trim()
    if (!trimmed) {
      toast.error("Title cannot be empty.")
      return
    }
    if (trimmed === (conversation.title ?? "")) {
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
        toast.error(result.error ?? "Could not rename conversation.")
        return
      }
      setIsEditing(false)
      void revalidateConversations(agentId)
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      setIsEditing(false)
      setDraftTitle(conversation.title ?? "")
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
        toast.error(result?.error ?? "Could not delete conversation.")
        return
      }
      toast.success("Conversation deleted.")
      setShowDelete(false)
      void revalidateConversations(agentId)
    })
  }

  if (isEditing) {
    return (
      <form
        onSubmit={submitRename}
        className={cn(
          "flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5",
          isActive && "border-foreground",
        )}
      >
        <input
          ref={inputRef}
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRenaming}
          maxLength={80}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          placeholder="Conversation title"
          aria-label="Conversation title"
        />
        <button
          type="submit"
          disabled={isRenaming}
          className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Save title"
        >
          <Check className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={isRenaming}
          onClick={() => {
            setIsEditing(false)
            setDraftTitle(conversation.title ?? "")
          }}
          className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Cancel rename"
        >
          <X className="size-3.5" />
        </button>
      </form>
    )
  }

  return (
    <>
      <div
        className={cn(
          "group relative flex items-center rounded-md",
          isActive ? "bg-muted" : "hover:bg-muted/60",
          isDeleting && "opacity-50",
        )}
      >
        <Link
          href={`/agents/${agentId}/chat/${conversation.id}`}
          className={cn(
            "min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm transition-colors",
            isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          aria-current={isActive ? "page" : undefined}
        >
          <span className="block truncate">{displayTitle}</span>
          <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
            {formatRelative(conversation.updatedAt)}
          </span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`More options for ${displayTitle}`}
              className={cn(
                "mr-1 rounded-sm p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus:opacity-100 group-hover:opacity-100",
                isActive && "opacity-100",
              )}
            >
              <MoreHorizontal className="size-4" />
            </button>
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
              className="text-destructive focus:text-destructive"
              onSelect={(event) => {
                event.preventDefault()
                setShowDelete(true)
              }}
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
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
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                confirmDelete()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Tiny relative-time formatter. Keeps the sidebar feeling live without
 * pulling in a date-fns dependency for a single helper.
 */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return "just now"
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}
