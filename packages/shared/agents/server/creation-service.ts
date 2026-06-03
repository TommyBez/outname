import 'server-only'
import { createHash } from 'node:crypto'
import { db } from '@outname/db'
import { type Agent, agent } from '@outname/db/schema'
import {
  type AgentScheduleMode,
  normalizeAgentScheduleMode,
  normalizeScheduleTimesForMode,
} from '@outname/shared/agent-schedule'
import { writeBootstrapFiles } from '@outname/shared/agents/server/bootstrap-files'
import { refreshAgentCapabilitySummary } from '@outname/shared/agents/server/capability-summary'
import type { StepLimitMode } from '@outname/shared/agents/server/creation-types'
import {
  DEFAULT_MODEL_BY_PROVIDER,
  isModelSelectionValid,
} from '@outname/shared/server/inference-models'
import {
  hasEnabledInferenceProvider,
  type InferenceProvider,
} from '@outname/shared/server/inference-providers'
import { eq } from 'drizzle-orm'

const HEARTBEAT_MIN = 5
const HEARTBEAT_MAX = 1440

export interface CreateAgentInput {
  dreamingEnabled: boolean
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  heartbeatScheduleMode?: AgentScheduleMode
  heartbeatScheduleTimes?: string[]
  idempotencyKey?: string
  identityCard: string
  inferenceProvider: InferenceProvider
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

function stableAgentIdForCreation(input: {
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
  if (
    !(await hasEnabledInferenceProvider({
      inferenceProvider: input.inferenceProvider,
      userId: input.userId,
    }))
  ) {
    throw new Error('Selected inference provider is not configured.')
  }
  const model = (await isModelSelectionValid({
    inferenceProvider: input.inferenceProvider,
    modelId: input.model,
  }))
    ? input.model
    : DEFAULT_MODEL_BY_PROVIDER[input.inferenceProvider]
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

  const inserted = await db
    .insert(agent)
    .values({
      id,
      userId: input.userId,
      name,
      model,
      enabled: true,
      inferenceProvider: input.inferenceProvider,
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
