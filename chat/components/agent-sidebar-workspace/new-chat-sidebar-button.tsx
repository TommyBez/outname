'use client'

import { MessageSquarePlus } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { isNewChatPath, newChatPath } from './conversations'

interface NewChatSidebarButtonProps {
  agentId: string
}

export function NewChatSidebarButton({ agentId }: NewChatSidebarButtonProps) {
  const router = useRouter()
  const pathname = usePathname()

  function handleNewChat() {
    // A unique `draft` query forces navigation even when the App Router still
    // considers us on `/chat/new` after `history.replaceState` promoted the URL.
    router.push(newChatPath(agentId, Date.now().toString(36)))
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
