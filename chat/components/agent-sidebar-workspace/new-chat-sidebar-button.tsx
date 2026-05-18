'use client'

import { MessageSquarePlus } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { newDraftConversationId } from '@/chat/lib/draft-conversation-id'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { isNewChatPath, newChatPath } from './conversations'

interface NewChatSidebarButtonProps {
  agentId: string
}

export function NewChatSidebarButton({ agentId }: NewChatSidebarButtonProps) {
  const router = useRouter()
  const pathname = usePathname()

  function handleNewChat() {
    // Pick the draft id on the client so navigation does not depend on a fresh
    // server render, and use `draft` in the URL to bust App Router cache.
    const conversationId = newDraftConversationId()
    router.push(newChatPath(agentId, conversationId))
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="text-muted-foreground hover:text-foreground"
        isActive={isNewChatPath(pathname, agentId)}
        onClick={handleNewChat}
        tooltip="New chat"
        type="button"
      >
        <MessageSquarePlus aria-hidden />
        <span>New chat</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
