import 'server-only'

import { and, eq } from 'drizzle-orm'
import { pokeHeartbeat } from '@/agent-runtime/server/session-events'
import { refreshAgentCapabilitySummary } from '@/agents/server/capability-summary'
import {
  clampInterval,
  normalizeNewlines,
} from '@/agents/server/creation-service'
import { enqueuePendingFileWrite } from '@/agents/server/pending-writes'
import { db } from '@/shared/db'
import { agent } from '@/shared/db/schema'
import { isModelIdValid } from '@/shared/server/ai-gateway-models'

export interface UpdateAgentInput {
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  id: string
  /**
   * IDENTITY.md content from the "Identity" tab. Empty string is a
   * legal value — it means "leave whatever is on disk alone". The
   * action only enqueues a pending write if the operator wrote
   * something AND it differs from the prefill that was rendered.
   */
  identityCard: string
  /** Original IDENTITY.md content the form was rendered with. */
  identityCardOriginal: string
  /** AGENTS.md content from the "Instructions" tab. */
  instructions: string
  /** Original AGENTS.md content the form was rendered with. */
  instructionsOriginal: string
  model: string
  name: string
  reflectionEnabled: boolean
  reflectionIntervalMinutes: number
  /** SOUL.md content from the "Soul" tab. */
  soul: string
  /** Original SOUL.md content the form was rendered with. */
  soulOriginal: string
  stepLimitCustom?: number | null
  stepLimitMode: 'custom' | 'grind' | 'high' | 'low' | 'medium'
  /** USER.md seed/correction content from the "User profile" tab. */
  userProfile: string
  /** Original USER.md content the form was rendered with. */
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
  // Skip the gateway round-trip if the model didn't change, since the
  // catalog fetch is the slowest part of this action.
  const model =
    input.model === existing.model || (await isModelIdValid(input.model))
      ? input.model
      : existing.model
  const heartbeatIntervalMinutes = clampInterval(input.heartbeatIntervalMinutes)
  const reflectionIntervalMinutes = clampInterval(
    input.reflectionIntervalMinutes
  )

  const [updated] = await db
    .update(agent)
    .set({
      name,
      model,
      heartbeatEnabled: input.heartbeatEnabled,
      heartbeatIntervalMinutes,
      reflectionEnabled: input.reflectionEnabled,
      reflectionIntervalMinutes,
      stepLimitMode: input.stepLimitMode,
      stepLimitCustom:
        input.stepLimitMode === 'custom'
          ? Math.max(1, Math.floor(input.stepLimitCustom ?? 30))
          : null,
      updatedAt: new Date(),
    })
    .where(eq(agent.id, input.id))
    .returning()

  // Bootstrap files: only enqueue a pending write when the operator
  // actually edited the textarea. This keeps the queue from
  // ballooning with no-op rows when the user just changes the model
  // or the heartbeat interval.
  //
  // Both sides of the diff are normalized to LF so a `<Textarea>`
  // round-trip — which on Windows hosts can introduce or strip CRLF
  // pairs — doesn't manufacture a phantom edit. We persist the
  // normalized content so disk and queue agree on a single line-ending
  // convention forever.
  const identityCardNorm = normalizeNewlines(input.identityCard)
  const identityCardOrigNorm = normalizeNewlines(input.identityCardOriginal)
  if (identityCardNorm !== identityCardOrigNorm) {
    await enqueuePendingFileWrite({
      agentId: input.id,
      path: 'IDENTITY.md',
      content: identityCardNorm,
    })
  }
  const soulNorm = normalizeNewlines(input.soul)
  const soulOrigNorm = normalizeNewlines(input.soulOriginal)
  if (soulNorm !== soulOrigNorm) {
    await enqueuePendingFileWrite({
      agentId: input.id,
      path: 'SOUL.md',
      content: soulNorm,
    })
  }
  const instructionsNorm = normalizeNewlines(input.instructions)
  const instructionsOrigNorm = normalizeNewlines(input.instructionsOriginal)
  if (instructionsNorm !== instructionsOrigNorm) {
    await enqueuePendingFileWrite({
      agentId: input.id,
      path: 'AGENTS.md',
      content: instructionsNorm,
    })
  }
  const userProfileNorm = normalizeNewlines(input.userProfile)
  const userProfileOrigNorm = normalizeNewlines(input.userProfileOriginal)
  if (userProfileNorm !== userProfileOrigNorm) {
    await enqueuePendingFileWrite({
      agentId: input.id,
      path: 'USER.md',
      content: userProfileNorm,
    })
  }

  await refreshAgentCapabilitySummary({
    agentId: input.id,
    bootstrap: {
      'AGENTS.md': instructionsNorm,
    },
  })

  // The ticker re-reads schedules on every loop. Poking a heartbeat
  // gives immediate feedback when users change the normal proactive
  // schedule; reflection changes wait for their own scheduler/manual
  // trigger so they don't surprise users with a deep review run.
  if (
    updated.enabled &&
    (existing.heartbeatEnabled !== updated.heartbeatEnabled ||
      existing.heartbeatIntervalMinutes !== updated.heartbeatIntervalMinutes)
  ) {
    try {
      await pokeHeartbeat({ agent: updated })
    } catch (err) {
      console.error(
        '[v0] updateAgentForUser: pokeHeartbeat after schedule change failed',
        err
      )
    }
  }
}
