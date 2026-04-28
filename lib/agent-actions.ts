"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath, updateTag } from "next/cache"
import { redirect } from "next/navigation"
import { requireSession } from "@/lib/auth-guard"
import {
  agentRunsTag,
  agentTag,
  conversationListTag,
  userAgentsTag,
} from "@/lib/cache-tags"
import { db } from "@/lib/db"
import { agent } from "@/lib/db/schema"
import { destroyAgentSandboxes } from "@/lib/agent-sandbox"
import {
  pokeHeartbeat,
  startAgentSession,
  stopAgentSession,
} from "@/lib/agent-session"
import {
  DEFAULT_MODEL_ID,
  isModelIdValid,
} from "@/lib/ai-gateway-models"

function nanoid() {
  return (
    "ag_" +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36).slice(-4)
  )
}

const HEARTBEAT_MIN = 5
const HEARTBEAT_MAX = 1440 // 24h

/** Clamp a heartbeat-interval choice into the accepted [5, 1440] range. */
function clampInterval(n: number): number {
  if (!Number.isFinite(n)) return 30
  if (n < HEARTBEAT_MIN) return HEARTBEAT_MIN
  if (n > HEARTBEAT_MAX) return HEARTBEAT_MAX
  return Math.floor(n)
}

interface CreateInput {
  name: string
  systemPrompt: string
  model: string
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
}

export async function createAgentAction(
  input: CreateInput,
): Promise<{ id: string }> {
  const session = await requireSession()

  const name = input.name.trim() || "New agent"
  const systemPrompt = input.systemPrompt
  const model = (await isModelIdValid(input.model))
    ? input.model
    : DEFAULT_MODEL_ID
  const heartbeatIntervalMinutes = clampInterval(input.heartbeatIntervalMinutes)

  const id = nanoid()
  const [created] = await db
    .insert(agent)
    .values({
      id,
      userId: session.user.id,
      name,
      systemPrompt,
      model,
      enabled: true,
      heartbeatEnabled: input.heartbeatEnabled,
      heartbeatIntervalMinutes,
    })
    .returning()

  // Boot the long-lived session immediately so a (possibly enabled)
  // heartbeat ticker starts producing runs without forcing the user
  // to chat or wait for the cron sweeper.
  try {
    await startAgentSession(created)
  } catch (err) {
    console.error("[v0] createAgentAction: startAgentSession failed", err)
  }

  updateTag(userAgentsTag(session.user.id))
  updateTag(agentTag(id))
  revalidatePath("/agents")
  revalidatePath("/")
  return { id }
}

interface UpdateInput {
  id: string
  name: string
  systemPrompt: string
  model: string
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
}

export async function updateAgentAction(input: UpdateInput): Promise<void> {
  const session = await requireSession()
  const [existing] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, input.id), eq(agent.userId, session.user.id)))
    .limit(1)
  if (!existing) throw new Error("Not found")

  const name = input.name.trim() || existing.name
  // System prompt: an explicit empty string is allowed (the model
  // falls back to AGENTS.md / SOUL.md only).
  const systemPrompt = input.systemPrompt
  // Skip the gateway round-trip if the model didn't change, since the
  // catalog fetch is the slowest part of this action.
  const model =
    input.model === existing.model || (await isModelIdValid(input.model))
      ? input.model
      : existing.model
  const heartbeatIntervalMinutes = clampInterval(input.heartbeatIntervalMinutes)

  const [updated] = await db
    .update(agent)
    .set({
      name,
      systemPrompt,
      model,
      heartbeatEnabled: input.heartbeatEnabled,
      heartbeatIntervalMinutes,
      updatedAt: new Date(),
    })
    .where(eq(agent.id, input.id))
    .returning()

  // The ticker reads its interval / opt-in once on session boot, so
  // mid-session schedule changes only take effect on the next restart.
  // Poke a heartbeat so the user sees immediate feedback when they
  // flip the switch.
  if (
    updated.enabled &&
    (existing.heartbeatEnabled !== updated.heartbeatEnabled ||
      existing.heartbeatIntervalMinutes !== updated.heartbeatIntervalMinutes)
  ) {
    try {
      await pokeHeartbeat({ agent: updated })
    } catch (err) {
      console.error(
        "[v0] updateAgentAction: pokeHeartbeat after schedule change failed",
        err,
      )
    }
  }

  updateTag(userAgentsTag(session.user.id))
  updateTag(agentTag(input.id))
  revalidatePath("/agents")
  revalidatePath(`/agents/${input.id}`)
  revalidatePath(`/agents/${input.id}/edit`)
  revalidatePath("/")
}

export async function toggleAgentAction(
  agentId: string,
  enabled: boolean,
): Promise<void> {
  const session = await requireSession()
  const [existing] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))
    .limit(1)
  if (!existing) return

  const [updated] = await db
    .update(agent)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(agent.id, agentId))
    .returning()

  if (!existing.enabled && updated.enabled) {
    try {
      await startAgentSession(updated)
    } catch (err) {
      console.error("[v0] toggleAgentAction: startAgentSession failed", err)
    }
  } else if (existing.enabled && !updated.enabled) {
    await stopAgentSession(agentId)
  }

  updateTag(userAgentsTag(session.user.id))
  updateTag(agentTag(agentId))
  revalidatePath("/agents")
  revalidatePath(`/agents/${agentId}`)
  revalidatePath("/")
}

export async function deleteAgentAction(agentId: string): Promise<void> {
  const session = await requireSession()
  const [existing] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))
    .limit(1)
  if (!existing) redirect("/agents")

  // Stop the session first so it doesn't try to write into a torn-down
  // sandbox or a deleted agent row mid-event.
  await stopAgentSession(agentId)

  // Best-effort: tear down both persistent sandboxes (system + exec)
  // before removing the row so we don't leak them. Any failure is
  // swallowed inside the helper.
  await destroyAgentSandboxes(agentId)

  await db
    .delete(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))

  updateTag(userAgentsTag(session.user.id))
  updateTag(agentTag(agentId))
  updateTag(agentRunsTag(agentId))
  updateTag(conversationListTag(agentId))
  revalidatePath("/agents")
  revalidatePath("/")
  redirect("/agents")
}
