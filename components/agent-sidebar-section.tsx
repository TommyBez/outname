import { requireSession } from "@/lib/auth-guard"
import { getAgentByIdForUser } from "@/lib/data"
import { listConversationsForAgent } from "@/lib/agent-chat"
import { getAgentRuntime } from "@/lib/agent-runtime-registry"
import {
  AgentSidebarWorkspace,
  type ConversationSummary,
} from "@/components/agent-sidebar-workspace"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { AgentKind } from "@/lib/db/schema"

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
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) return null

  const runtime = getAgentRuntime(agent.kind as AgentKind)
  const isChatCapable = Boolean(runtime?.buildAgent)

  const conversations: ConversationSummary[] = isChatCapable
    ? (await listConversationsForAgent(agent.id)).map((c) => ({
        id: c.id,
        title: c.title,
        // Serialise to ISO so the value is plain across the server/client
        // boundary. The client just passes it back to `new Date()` for
        // relative-time display.
        updatedAt: c.updatedAt.toISOString(),
      }))
    : []

  return (
    <AgentSidebarWorkspace
      agentId={agent.id}
      agentName={agent.name}
      enabled={agent.enabled}
      isChatCapable={isChatCapable}
      conversations={conversations}
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
    <SidebarGroup className="border-t border-sidebar-border pt-3 group-data-[collapsible=icon]:hidden">
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
