import { requireSession } from '@/auth/server/auth-guard'
import { AgentSidebarWorkspace } from '@/chat/components/agent-sidebar-workspace'
import type { ConversationSummary } from '@/chat/components/agent-sidebar-workspace/conversations'
import { getCachedConversationListForAgent } from '@/chat/server/chat'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { getCachedAgentByIdForUser } from '@/shared/server/data'

interface Props {
  params: Promise<{ agentId: string }>
}

/**
 * Server-side loader for the contextual agent workspace section in the
 * sidebar. Resolves the agent row, fetches its conversation list when
 * applicable, and hands everything to the client `AgentSidebarWorkspace`
 * component. Falls back silently (renders nothing) if the agent cannot
 * be resolved — the page itself will already have surfaced a 404.
 */
export async function AgentSidebarSection({ params }: Props) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    return null
  }

  // Phase 2: every agent is chat-capable. The "isChatCapable" prop is
  // retained on the workspace component for now so future kinds (e.g.
  // headless schedulers) can opt out without another schema change.
  const conversations: ConversationSummary[] = (
    await getCachedConversationListForAgent(agent.id)
  ).map((c) => ({
    id: c.id,
    title: c.title,
    // Serialise to ISO so the value is plain across the server/client
    // boundary. The client just passes it back to `new Date()` for
    // relative-time display.
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

/**
 * Skeleton used as a `<Suspense>` fallback so the sidebar slot doesn't
 * flicker while the agent row streams in. Matches the group's header
 * spacing so there's no layout shift on resolve.
 */
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
