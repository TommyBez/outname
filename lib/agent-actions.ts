"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireSession } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { agent, userSettings } from "@/lib/db/schema"
import { AGENT_KINDS, isAgentKind } from "@/workflows/agents/registry"

function nanoid() {
  return "ag_" + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(-4)
}

const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7]

function parseScheduleDays(formData: FormData): number[] {
  const selected = formData.getAll("scheduleDays").map((v) => Number(v))
  return selected.filter((n) => ISO_DAYS.includes(n))
}

function validateTime(value: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(value)
  if (!m) throw new Error("Invalid time (expected HH:MM)")
  const [, hh, mm] = m
  const h = Number(hh)
  const min = Number(mm)
  if (h < 0 || h > 23 || min < 0 || min > 59) {
    throw new Error("Invalid time (HH must be 00-23, MM must be 00-59)")
  }
  return `${hh}:${mm}`
}

export async function createAgentAction(formData: FormData) {
  const session = await requireSession()
  const kind = String(formData.get("kind") ?? "")
  if (!isAgentKind(kind)) throw new Error("Unknown agent kind")

  const name = String(formData.get("name") ?? "").trim() || AGENT_KINDS[kind].defaultName
  const scheduleTime = validateTime(String(formData.get("scheduleTime") ?? "08:00"))
  const scheduleDays = parseScheduleDays(formData)
  if (scheduleDays.length === 0) throw new Error("Pick at least one day")

  const id = nanoid()
  await db.insert(agent).values({
    id,
    userId: session.user.id,
    kind,
    name,
    enabled: true,
    scheduleTime,
    scheduleDays,
    config: null,
  })

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

  const name = String(formData.get("name") ?? existing.name).trim() || existing.name
  const scheduleTime = validateTime(String(formData.get("scheduleTime") ?? existing.scheduleTime))
  const scheduleDays = parseScheduleDays(formData)
  if (scheduleDays.length === 0) throw new Error("Pick at least one day")
  const enabled = formData.get("enabled") != null

  await db
    .update(agent)
    .set({
      name,
      scheduleTime,
      scheduleDays,
      enabled,
      updatedAt: new Date(),
    })
    .where(eq(agent.id, agentId))

  revalidatePath("/agents")
  revalidatePath(`/agents/${agentId}`)
  revalidatePath("/")
}

export async function toggleAgentAction(agentId: string, enabled: boolean) {
  const session = await requireSession()
  await db
    .update(agent)
    .set({ enabled, updatedAt: new Date() })
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))

  revalidatePath("/agents")
  revalidatePath(`/agents/${agentId}`)
  revalidatePath("/")
}

export async function deleteAgentAction(agentId: string) {
  const session = await requireSession()
  await db
    .delete(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))

  revalidatePath("/agents")
  revalidatePath("/")
  redirect("/agents")
}

export async function updateUserTimezoneAction(formData: FormData) {
  const session = await requireSession()
  const timezone = String(formData.get("timezone") ?? "UTC")
  // Best-effort validation: ask Intl to normalize it.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone })
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`)
  }

  // Upsert
  await db
    .insert(userSettings)
    .values({ userId: session.user.id, timezone })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { timezone, updatedAt: new Date() },
    })

  revalidatePath("/settings")
  revalidatePath("/agents")
}
