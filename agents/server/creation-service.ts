import 'server-only'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { assertUserCanCreateAgentWithinTransaction } from '@/agents/server/agent-limit'
import { writeBootstrapFiles } from '@/agents/server/bootstrap-files'
import { refreshAgentCapabilitySummary } from '@/agents/server/capability-summary'
import type { StepLimitMode } from '@/agents/server/creation-types'
import {
  type AgentScheduleMode,
  normalizeAgentScheduleMode,
  normalizeScheduleTimesForMode,
} from '@/shared/agent-schedule'
import { db } from '@/shared/db'
import { type Agent, agent } from '@/shared/db/schema'
import {
  DEFAULT_MODEL_ID,
  isModelIdValid,
} from '@/shared/server/ai-gateway-models'

export const HEARTBEAT_MIN = 5
export const HEARTBEAT_MAX = 1440

export interface CreateAgentInput {
  dreamingEnabled: boolean
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  heartbeatScheduleMode?: AgentScheduleMode
  heartbeatScheduleTimes?: string[]
  idempotencyKey?: string
  identityCard: string
  instructions: string
  model: string
  name: string
  soul: string
  stepLimitCustom?: number | null
  stepLimitMode: StepLimitMode
  userId: string
  userProfile: string
}

export interface CreateAgentResult {
  agent: Agent
  created: boolean
  id: string
}

function nanoid(): string {
  return (
    'ag_' +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36).slice(-4)
  )
}

export function stableAgentIdForCreation(input: {
  idempotencyKey: string
  userId: string
}): string {
  const hash = createHash('sha256')
    .update(`${input.userId}:${input.idempotencyKey}`)
    .digest('hex')
    .slice(0, 24)
  return `ag_${hash}`
}

// Normalize to LF so queued bootstrap file diffs stay stable across browsers and clipboards.
export function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, '\n')
}

export function clampInterval(n: number): number {
  if (!Number.isFinite(n)) {
    return 30
  }
  if (n < HEARTBEAT_MIN) {
    return HEARTBEAT_MIN
  }
  if (n > HEARTBEAT_MAX) {
    return HEARTBEAT_MAX
  }
  return Math.floor(n)
}

export async function createAgentForUser(
  input: CreateAgentInput
): Promise<CreateAgentResult> {
  const name = input.name.trim() || 'New agent'
  const model = (await isModelIdValid(input.model))
    ? input.model
    : DEFAULT_MODEL_ID
  const heartbeatIntervalMinutes = clampInterval(input.heartbeatIntervalMinutes)
  const heartbeatScheduleMode = normalizeAgentScheduleMode(
    input.heartbeatScheduleMode
  )
  const heartbeatScheduleTimes = normalizeScheduleTimesForMode({
    enabled: input.heartbeatEnabled,
    mode: heartbeatScheduleMode,
    times: input.heartbeatScheduleTimes,
  })
  const id = input.idempotencyKey
    ? stableAgentIdForCreation({
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      })
    : nanoid()

  const inserted = await db.transaction(async (tx) => {
    await assertUserCanCreateAgentWithinTransaction(tx, input.userId, {
      agentId: id,
    })

    return tx
      .insert(agent)
      .values({
        id,
        userId: input.userId,
        name,
        model,
        enabled: true,
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
      })
      .onConflictDoNothing()
      .returning()
  })

  const created = inserted.length > 0
  const row =
    inserted[0] ?? (await readExistingAgentForCreate(id, input.userId))

  // Idempotent replays may hit an existing row; direct sandbox writes let retries self-heal.
  await writeInitialBootstrapFiles({
    agentId: id,
    identityCard: input.identityCard,
    instructions: input.instructions,
    soul: input.soul,
    userProfile: input.userProfile,
  })

  await refreshAgentCapabilitySummary({
    agentId: id,
    bootstrap: {
      'AGENTS.md': normalizeNewlines(input.instructions).trim(),
    },
  })

  return { id, agent: row, created }
}

async function readExistingAgentForCreate(
  id: string,
  userId: string
): Promise<Agent> {
  const [row] = await db.select().from(agent).where(eq(agent.id, id)).limit(1)

  if (!row) {
    throw new Error('Could not create agent.')
  }
  if (row.userId !== userId) {
    throw new Error('Agent creation key collision.')
  }
  return row
}

async function writeInitialBootstrapFiles(input: {
  agentId: string
  identityCard: string
  instructions: string
  soul: string
  userProfile: string
}): Promise<void> {
  const files: Parameters<typeof writeBootstrapFiles>[0]['files'] = {}
  const identityCard = normalizeNewlines(input.identityCard).trim()
  if (identityCard.length > 0) {
    files['IDENTITY.md'] = identityCard
  }

  const soul = normalizeNewlines(input.soul).trim()
  if (soul.length > 0) {
    files['SOUL.md'] = soul
  }

  const instructions = normalizeNewlines(input.instructions).trim()
  if (instructions.length > 0) {
    files['AGENTS.md'] = instructions
  }

  const userProfile = normalizeNewlines(input.userProfile).trim()
  if (userProfile.length > 0) {
    files['USER.md'] = userProfile
  }

  await writeBootstrapFiles({
    agentId: input.agentId,
    files,
  })
}
