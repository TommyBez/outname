'use client'

import {
  Brain,
  FileText,
  Info,
  MessageSquarePlus,
  Settings as SettingsIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import useSWR from 'swr'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
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
            enabled ? 'bg-accent' : 'bg-muted-foreground'
          )}
        />
        <span className="truncate">{agentName}</span>
      </SidebarGroupLabel>

      <SidebarGroupContent>
        {isChatCapable ? (
          <ChatCapableWorkspace
            agentId={agentId}
            conversations={conversations}
            pathname={pathname}
          />
        ) : (
          <SidebarMenu>
            <WorkspaceLinks agentId={agentId} pathname={pathname} />
          </SidebarMenu>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function ChatCapableWorkspace({
  agentId,
  conversations,
  pathname,
}: {
  agentId: string
  conversations: ConversationSummary[]
  pathname: string | null
}) {
  return (
    <SidebarMenu>
      <WorkspaceLinks agentId={agentId} includeExtended pathname={pathname} />
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          className="text-muted-foreground hover:text-foreground"
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
  )
}

function WorkspaceLinks({
  agentId,
  includeExtended = false,
  pathname,
}: {
  agentId: string
  includeExtended?: boolean
  pathname: string | null
}) {
  return (
    <>
      <WorkspaceLink
        href={`/agents/${agentId}/about`}
        icon={<Info aria-hidden />}
        isActive={pathname === `/agents/${agentId}/about`}
        label="About"
      />
      <WorkspaceLink
        href={`/agents/${agentId}/edit`}
        icon={<SettingsIcon aria-hidden />}
        isActive={pathname === `/agents/${agentId}/edit`}
        label="Configure"
      />
      {includeExtended && (
        <>
          <WorkspaceLink
            href={`/agents/${agentId}/timeline`}
            icon={<FileText aria-hidden />}
            isActive={pathname === `/agents/${agentId}/timeline`}
            label="Timeline"
          />
          <WorkspaceLink
            href={`/agents/${agentId}/dreams`}
            icon={<Brain aria-hidden />}
            isActive={pathname === `/agents/${agentId}/dreams`}
            label="DREAMS"
          />
        </>
      )}
    </>
  )
}

function WorkspaceLink({
  href,
  icon,
  isActive,
  label,
}: {
  href: string
  icon: ReactNode
  isActive: boolean
  label: string
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <Link href={href}>
          {icon}
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
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
