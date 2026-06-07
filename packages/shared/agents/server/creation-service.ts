import 'server-only'
import { createHash } from 'node:crypto'
import { db } from '@outname/db'
import { type Agent, agent, user } from '@outname/db/schema'
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
import { eq, sql } from 'drizzle-orm'

const HEARTBEAT_MIN = 5
const HEARTBEAT_MAX = 1440
export const NON_ADMIN_AGENT_LIMIT = 3

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

export class AgentCreationLimitExceededError extends Error {
  constructor() {
    super(`Non-admin users can create at most ${NON_ADMIN_AGENT_LIMIT} agents.`)
    this.name = 'AgentCreationLimitExceededError'
  }
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
  const existingAgent = input.idempotencyKey
    ? await readExistingAgentForCreateIfPresent(id, input.userId)
    : null

  if (!existingAgent) {
    await assertAgentCreationAllowed(input.userId)
  }

  const inserted = existingAgent
    ? []
    : await db
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
    inserted[0] ??
    existingAgent ??
    (await readExistingAgentForCreate(id, input.userId))

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

async function assertAgentCreationAllowed(userId: string): Promise<void> {
  if (await userIsAdmin(userId)) {
    return
  }

  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(agent)
    .where(eq(agent.userId, userId))

  if ((row?.total ?? 0) >= NON_ADMIN_AGENT_LIMIT) {
    throw new AgentCreationLimitExceededError()
  }
}

async function userIsAdmin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return isAdminRole(row?.role)
}

function isAdminRole(role: string | null | undefined): boolean {
  return (
    role
      ?.split(',')
      .map((value) => value.trim().toLowerCase())
      .includes('admin') ?? false
  )
}

async function readExistingAgentForCreate(
  id: string,
  userId: string
): Promise<Agent> {
  const row = await readExistingAgentForCreateIfPresent(id, userId)

  if (!row) {
    throw new Error('Could not create agent.')
  }
  return row
}

async function readExistingAgentForCreateIfPresent(
  id: string,
  userId: string
): Promise<Agent | null> {
  const [row] = await db.select().from(agent).where(eq(agent.id, id)).limit(1)

  if (!row) {
    return null
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
