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
import { destroyAgentSandbox } from "@/lib/agent-sandbox"
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
const DEFAULT_HEARTBEAT_INTERVAL = 30

/**
 * Best-effort coerce a `FormData` heartbeat-interval input into the
 * accepted [5, 1440] range. Returns the default on a missing/invalid
 * value rather than throwing — operators get a server-action error
 * for malformed input via `parseHeartbeatInterval` higher up.
 */
function parseHeartbeatInterval(raw: FormDataEntryValue | null): number {
  const n = Number.parseInt(String(raw ?? ""), 10)
  if (!Number.isFinite(n)) return DEFAULT_HEARTBEAT_INTERVAL
  if (n < HEARTBEAT_MIN) return HEARTBEAT_MIN
  if (n > HEARTBEAT_MAX) return HEARTBEAT_MAX
  return n
}

export async function createAgentAction(formData: FormData) {
  const session = await requireSession()

  const name = String(formData.get("name") ?? "").trim() || "New agent"
  const systemPrompt = String(formData.get("systemPrompt") ?? "").trim()

  const requestedModel =
    String(formData.get("model") ?? "").trim() || DEFAULT_MODEL_ID
  const model = (await isModelIdValid(requestedModel))
    ? requestedModel
    : DEFAULT_MODEL_ID

  const heartbeatEnabled = formData.get("heartbeatEnabled") != null
  const heartbeatIntervalMinutes = parseHeartbeatInterval(
    formData.get("heartbeatIntervalMinutes"),
  )

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
      heartbeatEnabled,
      heartbeatIntervalMinutes,
    })
    .returning()

  // Newly-enabled agent → boot its long-lived session immediately so
  // the (possibly enabled) heartbeat ticker starts producing runs
  // without the user having to chat first or wait for the cron sweeper.
  if (created.enabled) {
    try {
      await startAgentSession(created)
    } catch (err) {
      console.error("[v0] createAgentAction: startAgentSession failed", err)
    }
  }

  updateTag(userAgentsTag(session.user.id))
  updateTag(agentTag(id))
  revalidatePath("/agents")
  revalidatePath("/")
  redirect(`/agents/${id}`)
}

export async function updateAgentAction(agentId: string, formData: FormData) {
  const session = await requireSession()
  const [existing] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))
    .limit(1)
  if (!existing) throw new Error("Not found")

  const name =
    String(formData.get("name") ?? existing.name).trim() || existing.name

  // System prompt: an explicit empty string is allowed (the model
  // falls back to AGENTS.md / SOUL.md only). We only treat a missing
  // form field (`null`) as "leave unchanged".
  const rawSystemPrompt = formData.get("systemPrompt")
  const systemPrompt =
    rawSystemPrompt == null ? existing.systemPrompt : String(rawSystemPrompt)

  const requestedModel =
    String(formData.get("model") ?? existing.model).trim() || existing.model
  const model =
    requestedModel === existing.model || (await isModelIdValid(requestedModel))
      ? requestedModel
      : existing.model

  const enabled = formData.get("enabled") != null
  const heartbeatEnabled = formData.get("heartbeatEnabled") != null
  const heartbeatIntervalMinutes = parseHeartbeatInterval(
    formData.get("heartbeatIntervalMinutes"),
  )

  const [updated] = await db
    .update(agent)
    .set({
      name,
      systemPrompt,
      model,
      enabled,
      heartbeatEnabled,
      heartbeatIntervalMinutes,
      updatedAt: new Date(),
    })
    .where(eq(agent.id, agentId))
    .returning()

  // React to enabled-state transitions on the agent's session.
  if (!existing.enabled && updated.enabled) {
    try {
      await startAgentSession(updated)
    } catch (err) {
      console.error("[v0] updateAgentAction: startAgentSession failed", err)
    }
  } else if (existing.enabled && !updated.enabled) {
    await stopAgentSession(agentId)
  } else if (
    updated.enabled &&
    (existing.heartbeatEnabled !== updated.heartbeatEnabled ||
      existing.heartbeatIntervalMinutes !== updated.heartbeatIntervalMinutes)
  ) {
    // The ticker reads its interval / opt-in once on session boot, so
    // mid-session changes don't take effect until the next session
    // restart. Poke a heartbeat so the user sees something happen
    // immediately when they flip the switch — and the next cron sweep
    // (or manual disable→enable) will re-cycle the ticker.
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
  updateTag(agentTag(agentId))
  revalidatePath("/agents")
  revalidatePath(`/agents/${agentId}`)
  revalidatePath(`/agents/${agentId}/edit`)
  revalidatePath("/")
}

export async function toggleAgentAction(agentId: string, enabled: boolean) {
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

export async function deleteAgentAction(agentId: string) {
  const session = await requireSession()
  const [existing] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))
    .limit(1)
  if (!existing) {
    redirect("/agents")
  }

  // Stop the session first so it doesn't try to write into a torn-down
  // sandbox or a deleted agent row mid-event.
  await stopAgentSession(agentId)

  // Best-effort: tear down the persistent sandbox before removing the
  // row so we don't leak it. Any failure is swallowed inside the helper.
  await destroyAgentSandbox(agentId)

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
