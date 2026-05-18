'use client'

import { Check, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
import { toast } from 'sonner'
import {
  deleteConversationAction,
  renameConversationAction,
} from '@/chat/server/actions'
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
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import {
  type ConversationSummary,
  revalidateConversations,
} from './conversations'

interface ConversationRowProps {
  agentId: string
  conversation: ConversationSummary
  isActive: boolean
}

export function ConversationRow({
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

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

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
          <Button
            aria-label="Save title"
            className="border border-transparent p-1 text-muted-foreground transition-colors hover:border-sidebar-border hover:bg-sidebar-accent hover:text-foreground disabled:opacity-50"
            disabled={isRenaming}
            type="submit"
          >
            <Check className="size-3.5" />
          </Button>
          <Button
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
          </Button>
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
        <ConversationMenu
          displayTitle={displayTitle}
          onDelete={() => setShowDelete(true)}
          onRename={() => setIsEditing(true)}
        />
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

function ConversationMenu({
  displayTitle,
  onDelete,
  onRename,
}: {
  displayTitle: string
  onDelete: () => void
  onRename: () => void
}) {
  return (
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
            onRename()
          }}
        >
          <Pencil className="mr-2 size-3.5" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            onDelete()
          }}
          variant="destructive"
        >
          <Trash2 className="mr-2 size-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
