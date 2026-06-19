'use client'

import { newChatConversationId } from '@outname/ai/chat/lib/new-chat-conversation-id'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@outname/ui/components/ui/sidebar'
import { cn } from '@outname/ui/lib/utils'
import { Bot, MessageSquarePlus } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ConversationRow } from './agent-sidebar-workspace/conversation-row'
import type { ConversationSummary } from './agent-sidebar-workspace/conversations'
import {
  conversationsSwrKey,
  fetchConversations,
} from './agent-sidebar-workspace/conversations'

interface AgentSidebarWorkspaceProps {
  agentId: string
  agentName: string
  conversations: ConversationSummary[]
  enabled: boolean
  isChatCapable: boolean
}

export function AgentSidebarWorkspace({
  agentId,
  agentName,
  enabled,
  isChatCapable,
  conversations: initialConversations,
}: AgentSidebarWorkspaceProps) {
  const pathname = usePathname()
  const { data: conversations = initialConversations } = useSWR<
    ConversationSummary[]
  >(isChatCapable ? conversationsSwrKey(agentId) : null, fetchConversations, {
    fallbackData: initialConversations,
    revalidateOnFocus: true,
  })

  return (
    <SidebarGroup className="border-sidebar-border border-t pt-3 group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'inline-block size-1.5 shrink-0 rounded-full',
            enabled ? 'bg-brand' : 'bg-muted-foreground'
          )}
        />
        <span className="truncate">{agentName}</span>
      </SidebarGroupLabel>

      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === `/agents/${agentId}`}
              tooltip="Agent overview"
            >
              <Link href={`/agents/${agentId}`}>
                <Bot aria-hidden />
                <span>Overview</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>

      {isChatCapable ? (
        <ChatHistoryGroup
          agentId={agentId}
          conversations={conversations}
          pathname={pathname}
        />
      ) : null}
    </SidebarGroup>
  )
}

function ChatHistoryGroup({
  agentId,
  conversations,
  pathname,
}: {
  agentId: string
  conversations: ConversationSummary[]
  pathname: string | null
}) {
  const { push } = useRouter()
  const newChatPath = `/agents/${agentId}/chat/new`

  return (
    <div className="mt-4 border-sidebar-border border-t pt-3">
      <SidebarGroupLabel>Chats</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            className="text-muted-foreground hover:text-foreground"
            isActive={pathname === newChatPath}
            onClick={() => {
              push(`${newChatPath}?draft=${newChatConversationId()}`)
            }}
            tooltip="New chat"
            type="button"
          >
            <MessageSquarePlus aria-hidden />
            <span>New chat</span>
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
    </div>
  )
}

function isActive(
  pathname: string | null,
  agentId: string,
  conversationId: string
): boolean {
  if (!pathname) {
    return false
  }
  return pathname === `/agents/${agentId}/chat/${conversationId}`
}
