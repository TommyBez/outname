import { notFound } from 'next/navigation'
import { requireSession } from '@/auth/server/auth-guard'
import type { Agent } from '@/shared/db/schema'
import { getCachedAgentByIdForUser } from '@/shared/server/data'
import { AgentWorkspaceHeader } from './agent-workspace-header'

type Params = Promise<{ agentId: string }>

export async function AgentWorkspaceFrame({
  children,
  params,
}: {
  children: React.ReactNode
  params: Params
}) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  return (
    <>
      <AgentWorkspaceHeader agent={toHeaderAgent(agent)} />
      <div className="mt-8 min-w-0">{children}</div>
    </>
  )
}

export function AgentWorkspaceSkeleton() {
  return (
    <div className="border-foreground border-t-4 pt-6">
      <div className="h-3 w-32 animate-pulse bg-muted" />
      <div className="mt-4 h-12 w-80 animate-pulse bg-muted" />
      <div className="mt-6 h-12 w-full animate-pulse bg-muted" />
    </div>
  )
}

function toHeaderAgent(agent: Agent) {
  return {
    enabled: agent.enabled,
    heartbeatEnabled: agent.heartbeatEnabled,
    heartbeatScheduleMode: agent.heartbeatScheduleMode,
    heartbeatScheduleTimes: agent.heartbeatScheduleTimes,
    heartbeatIntervalMinutes: agent.heartbeatIntervalMinutes,
    id: agent.id,
    model: agent.model,
    name: agent.name,
    dreamingEnabled: agent.dreamingEnabled,
    dreamingScheduleMode: agent.dreamingScheduleMode,
    dreamingScheduleTimes: agent.dreamingScheduleTimes,
    dreamingIntervalMinutes: agent.dreamingIntervalMinutes,
  }
}
