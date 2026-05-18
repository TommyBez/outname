import { customInstructionsFromAgentsMd } from '@/agents/server/bootstrap-files'
import { getAgentByIdForUser, getAgentMemoryFile } from '@/shared/server/data'

export async function getCurrent(agentId: string, userId: string) {
  const agentRow = await getAgentByIdForUser(agentId, userId)
  if (!agentRow) {
    throw new Error('Not found')
  }
  const [identityCard, soul, instructions, userProfile] = await Promise.all([
    resolveBootstrap(agentId, 'IDENTITY.md'),
    resolveBootstrap(agentId, 'SOUL.md'),
    resolveBootstrap(agentId, 'AGENTS.md'),
    resolveBootstrap(agentId, 'USER.md'),
  ])
  return {
    name: agentRow.name,
    model: agentRow.model,
    heartbeatEnabled: agentRow.heartbeatEnabled,
    heartbeatScheduleMode: agentRow.heartbeatScheduleMode,
    heartbeatScheduleTimes: agentRow.heartbeatScheduleTimes,
    heartbeatIntervalMinutes: agentRow.heartbeatIntervalMinutes,
    dreamingEnabled: agentRow.dreamingEnabled,
    stepLimitMode: (agentRow.stepLimitMode ?? 'medium') as
      | 'custom'
      | 'grind'
      | 'high'
      | 'low'
      | 'medium',
    stepLimitCustom: agentRow.stepLimitCustom,
    identityCard,
    soul,
    instructions,
    userProfile,
  }
}

async function resolveBootstrap(agentId: string, path: string) {
  const file = await getAgentMemoryFile({ agentId, path })
  if (path === 'AGENTS.md' && file?.content) {
    return customInstructionsFromAgentsMd(file.content)
  }
  return file?.content ?? ''
}
