import 'server-only'
import { and, count, eq } from 'drizzle-orm'
import {
  type AgentCreationLimitState,
  AgentLimitReachedError,
  MAX_AGENTS_PER_USER,
} from '@/agents/shared/agent-limit-types'
import { db } from '@/shared/db'
import { agent, user } from '@/shared/db/schema'
import { getAgentByIdForUser } from '@/shared/server/data'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

function parseAdminUserIds(): string[] {
  const raw = process.env.BETTER_AUTH_ADMIN_USER_IDS
  if (!raw) {
    return []
  }
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export async function isAdminUser(userId: string): Promise<boolean> {
  if (parseAdminUserIds().includes(userId)) {
    return true
  }

  const [row] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  return row?.role === 'admin'
}

export async function countAgentsForUser(userId: string): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(agent)
    .where(eq(agent.userId, userId))

  return Number(result?.value ?? 0)
}

export async function getAgentCreationLimitState(
  userId: string
): Promise<AgentCreationLimitState> {
  const isAdmin = await isAdminUser(userId)
  const countValue = await countAgentsForUser(userId)
  const limit = isAdmin ? Number.POSITIVE_INFINITY : MAX_AGENTS_PER_USER

  return {
    canCreate: isAdmin || countValue < MAX_AGENTS_PER_USER,
    count: countValue,
    isAdmin,
    limit: Number.isFinite(limit) ? limit : MAX_AGENTS_PER_USER,
  }
}

export async function canUserCreateAgent(
  userId: string,
  options?: { agentId?: string }
): Promise<boolean> {
  if (await isAdminUser(userId)) {
    return true
  }

  const currentCount = await countAgentsForUser(userId)
  if (currentCount < MAX_AGENTS_PER_USER) {
    return true
  }

  if (options?.agentId) {
    const existing = await getAgentByIdForUser(options.agentId, userId)
    if (existing) {
      return true
    }
  }

  return false
}

export async function assertUserCanCreateAgentWithinTransaction(
  tx: DbTransaction,
  userId: string,
  options?: { agentId?: string }
): Promise<void> {
  const [userRow] = await tx
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .for('update')
    .limit(1)

  if (!userRow) {
    throw new Error('User not found.')
  }

  if (parseAdminUserIds().includes(userId) || userRow.role === 'admin') {
    return
  }

  if (options?.agentId) {
    const [existing] = await tx
      .select({ id: agent.id })
      .from(agent)
      .where(and(eq(agent.id, options.agentId), eq(agent.userId, userId)))
      .limit(1)
    if (existing) {
      return
    }
  }

  const [result] = await tx
    .select({ value: count() })
    .from(agent)
    .where(eq(agent.userId, userId))

  const currentCount = Number(result?.value ?? 0)
  if (currentCount >= MAX_AGENTS_PER_USER) {
    throw new AgentLimitReachedError(MAX_AGENTS_PER_USER, currentCount)
  }
}

export async function assertUserCanCreateAgent(
  userId: string,
  options?: { agentId?: string }
): Promise<void> {
  await db.transaction(async (tx) => {
    await assertUserCanCreateAgentWithinTransaction(tx, userId, options)
  })
}

export function isAgentLimitReachedError(
  error: unknown
): error is AgentLimitReachedError {
  return error instanceof AgentLimitReachedError
}
