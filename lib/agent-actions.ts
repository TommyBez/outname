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
import { startAgentSession, stopAgentSession } from "@/lib/agent-session"
import { AGENT_KINDS, isAgentKind } from "@/workflows/agents/registry"

function nanoid() {
  return (
    "ag_" +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36).slice(-4)
  )
}

export async function createAgentAction(formData: FormData) {
  const session = await requireSession()
  const kind = String(formData.get("kind") ?? "")
  if (!isAgentKind(kind)) throw new Error("Unknown agent kind")

  const name =
    String(formData.get("name") ?? "").trim() || AGENT_KINDS[kind].defaultName

  const id = nanoid()
  const [created] = await db
    .insert(agent)
    .values({
      id,
      userId: session.user.id,
      kind,
      name,
      enabled: true,
      config: null,
    })
    .returning()

  // Newly-enabled agent → boot its long-lived session immediately so
  // the heartbeat ticker starts producing runs without the user having
  // to chat first or wait for the cron sweeper.
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
  const enabled = formData.get("enabled") != null

  const [updated] = await db
    .update(agent)
    .set({
      name,
      enabled,
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
