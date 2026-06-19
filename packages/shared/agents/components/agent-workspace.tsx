import { requireSession } from '@outname/auth/server/auth-guard'
import type { Agent } from '@outname/db/schema'
import { getCachedAgentByIdForUser } from '@outname/shared/server/data'
import { getUserTimeDisplay } from '@outname/shared/server/user-time-display'
import { notFound } from 'next/navigation'
import { AgentWorkspaceHeader } from './agent-workspace-header'

type Params = Promise<{ agentId: string }>

export async function AgentWorkspaceFrame({
  children,
  params,
}: {
  children: React.ReactNode
  params: Params
}) {
  const [{ agentId }, session] = await Promise.all([params, requireSession()])
  const [agent, display] = await Promise.all([
    getCachedAgentByIdForUser(agentId, session.user.id),
    getUserTimeDisplay(session.user.id),
  ])
  if (!agent) {
    notFound()
  }

  const headerAgent = toHeaderAgent(agent)

  return (
    <>
      <AgentWorkspaceHeader
        agent={headerAgent}
        heartbeatScheduleLabel={display.agentScheduleInline({
          enabled: headerAgent.heartbeatEnabled,
          intervalMinutes: headerAgent.heartbeatIntervalMinutes,
          mode: headerAgent.heartbeatScheduleMode,
          times: headerAgent.heartbeatScheduleTimes,
        })}
      />
      <div className="mt-8 min-w-0">{children}</div>
    </>
  )
}

export function AgentWorkspaceSkeleton() {
  return (
    <div className="border-border border-t-4 pt-6">
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
  }
}
