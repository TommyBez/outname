import 'server-only'

import { and, eq } from 'drizzle-orm'
import { writeBootstrapFiles } from '@/agents/server/bootstrap-files'
import { refreshAgentCapabilitySummary } from '@/agents/server/capability-summary'
import {
  clampInterval,
  normalizeNewlines,
} from '@/agents/server/creation-service'
import {
  type AgentScheduleMode,
  normalizeAgentScheduleMode,
  normalizeScheduleTimesForMode,
} from '@/shared/agent-schedule'
import { db } from '@/shared/db'
import { agent } from '@/shared/db/schema'
import { isModelIdValid } from '@/shared/server/ai-gateway-models'

export interface UpdateAgentInput {
  dreamingEnabled: boolean
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  heartbeatScheduleMode: AgentScheduleMode
  heartbeatScheduleTimes: string[]
  id: string
  identityCard: string
  identityCardOriginal: string
  instructions: string
  instructionsOriginal: string
  model: string
  name: string
  soul: string
  soulOriginal: string
  stepLimitCustom?: number | null
  stepLimitMode: 'custom' | 'grind' | 'high' | 'low' | 'medium'
  userProfile: string
  userProfileOriginal: string
}

export async function updateAgentForUser(
  input: UpdateAgentInput & { userId: string }
): Promise<void> {
  const [existing] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, input.id), eq(agent.userId, input.userId)))
    .limit(1)
  if (!existing) {
    throw new Error('Not found')
  }

  const name = input.name.trim() || existing.name
  // Skip the catalog fetch when the model did not change.
  const model =
    input.model === existing.model || (await isModelIdValid(input.model))
      ? input.model
      : existing.model
  const heartbeatIntervalMinutes = clampInterval(input.heartbeatIntervalMinutes)
  const heartbeatScheduleMode = normalizeAgentScheduleMode(
    input.heartbeatScheduleMode
  )
  const heartbeatScheduleTimes = normalizeScheduleTimesForMode({
    enabled: input.heartbeatEnabled,
    mode: heartbeatScheduleMode,
    times: input.heartbeatScheduleTimes,
  })

  await db
    .update(agent)
    .set({
      name,
      model,
      heartbeatEnabled: input.heartbeatEnabled,
      heartbeatScheduleMode,
      heartbeatScheduleTimes,
      heartbeatIntervalMinutes,
      dreamingEnabled: input.dreamingEnabled,
      stepLimitMode: input.stepLimitMode,
      stepLimitCustom:
        input.stepLimitMode === 'custom'
          ? Math.max(1, Math.floor(input.stepLimitCustom ?? 30))
          : null,
      updatedAt: new Date(),
    })
    .where(eq(agent.id, input.id))

  // Normalize both sides to LF so textarea round-trips do not manufacture
  // phantom edits on Windows, and only write files when the operator really
  // changed the file.
  const files: Parameters<typeof writeBootstrapFiles>[0]['files'] = {}
  const identityCardNorm = normalizeNewlines(input.identityCard)
  const identityCardOrigNorm = normalizeNewlines(input.identityCardOriginal)
  if (identityCardNorm !== identityCardOrigNorm) {
    files['IDENTITY.md'] = identityCardNorm
  }
  const soulNorm = normalizeNewlines(input.soul)
  const soulOrigNorm = normalizeNewlines(input.soulOriginal)
  if (soulNorm !== soulOrigNorm) {
    files['SOUL.md'] = soulNorm
  }
  const instructionsNorm = normalizeNewlines(input.instructions)
  const instructionsOrigNorm = normalizeNewlines(input.instructionsOriginal)
  if (instructionsNorm !== instructionsOrigNorm) {
    files['AGENTS.md'] = instructionsNorm
  }
  const userProfileNorm = normalizeNewlines(input.userProfile)
  const userProfileOrigNorm = normalizeNewlines(input.userProfileOriginal)
  if (userProfileNorm !== userProfileOrigNorm) {
    files['USER.md'] = userProfileNorm
  }

  if (Object.keys(files).length > 0) {
    await writeBootstrapFiles({
      agentId: input.id,
      files,
    })
  }

  await refreshAgentCapabilitySummary({
    agentId: input.id,
    bootstrap: {
      'AGENTS.md': instructionsNorm,
    },
  })
}
