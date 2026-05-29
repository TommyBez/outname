import { AgentSidebarWorkspace } from '@outname/ai/chat/components/agent-sidebar-workspace'
import type { ConversationSummary } from '@outname/ai/chat/components/agent-sidebar-workspace/conversations'
import { getCachedConversationListForAgent } from '@outname/ai/chat/server/chat'
import { requireSession } from '@outname/auth/server/auth-guard'
import { getCachedAgentByIdForUser } from '@outname/shared/server/data'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from '@outname/ui/components/ui/sidebar'

interface Props {
  params: Promise<{ agentId: string }>
}

export async function AgentSidebarSection({ params }: Props) {
  const [{ agentId }, session] = await Promise.all([params, requireSession()])
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    return null
  }

  const conversations: ConversationSummary[] = (
    await getCachedConversationListForAgent(agent.id)
  ).map((c) => ({
    id: c.id,
    title: c.title,
    // Use ISO strings so the value stays plain across the server/client boundary.
    updatedAt: c.updatedAt.toISOString(),
  }))

  return (
    <AgentSidebarWorkspace
      agentId={agent.id}
      agentName={agent.name}
      conversations={conversations}
      enabled={agent.enabled}
      isChatCapable
    />
  )
}

export function AgentSidebarSectionSkeleton() {
  return (
    <SidebarGroup className="border-sidebar-border border-t pt-3 group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>
        <span className="inline-block h-3 w-28 animate-pulse rounded-sm bg-sidebar-accent/60" />
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {[0, 1, 2].map((index) => (
            <SidebarMenuItem key={index}>
              <div className="mx-2 my-1 h-5 w-full animate-pulse rounded-sm bg-sidebar-accent/40" />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
