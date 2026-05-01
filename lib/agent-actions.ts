'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { enqueuePendingFileWrite } from '@/lib/agent-pending-writes'
import { destroyAgentSandboxes } from '@/lib/agent-sandbox'
import {
  pokeHeartbeat,
  startAgentSession,
  stopAgentSession,
} from '@/lib/agent-session'
import { DEFAULT_MODEL_ID, isModelIdValid } from '@/lib/ai-gateway-models'
import { requireSession } from '@/lib/auth-guard'
import {
  agentRunsTag,
  agentTag,
  conversationListTag,
  userAgentsTag,
} from '@/lib/cache-tags'
import { db } from '@/lib/db'
import { agent } from '@/lib/db/schema'

function nanoid() {
  return (
    'ag_' +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36).slice(-4)
  )
}

const HEARTBEAT_MIN = 5
const HEARTBEAT_MAX = 1440 // 24h

/**
 * Normalize CRLF / CR line endings to LF. The Windows clipboard, OS
 * file-drag, and certain browsers will hand `<Textarea>` content
 * back with `\r\n` separators, while files we ourselves write to
 * disk via `Buffer.from(..., 'utf8')` keep whatever was passed in.
 * Without this normalization, the update action's exact-string
 * change check thinks every save is a real edit and the queue
 * fills with no-op rows.
 */
function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, '\n')
}

/** Clamp a heartbeat-interval choice into the accepted [5, 1440] range. */
function clampInterval(n: number): number {
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

interface CreateInput {
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  /**
   * SOUL.md content authored via the "Identity" tab. Empty string
   * means "don't seed an identity yet" — the persona file is left
   * absent until the user fills it in later.
   */
  identity: string
  /**
   * AGENTS.md content authored via the "Instructions" tab. Empty
   * string means "use the default seed template" — the
   * `seedAgentsMd` step writes the platform default on first
   * sandbox boot.
   */
  instructions: string
  model: string
  name: string
  reflectionEnabled: boolean
  reflectionIntervalMinutes: number
}

export async function createAgentAction(
  input: CreateInput
): Promise<{ id: string }> {
  const session = await requireSession()

  const name = input.name.trim() || 'New agent'
  const model = (await isModelIdValid(input.model))
    ? input.model
    : DEFAULT_MODEL_ID
  const heartbeatIntervalMinutes = clampInterval(input.heartbeatIntervalMinutes)
  const reflectionIntervalMinutes = clampInterval(
    input.reflectionIntervalMinutes
  )

  const id = nanoid()
  const [created] = await db
    .insert(agent)
    .values({
      id,
      userId: session.user.id,
      name,
      model,
      enabled: true,
      heartbeatEnabled: input.heartbeatEnabled,
      heartbeatIntervalMinutes,
      reflectionEnabled: input.reflectionEnabled,
      reflectionIntervalMinutes,
    })
    .returning()

  // Queue the persona-file content authored in the form, if any. The
  // first session event will run `drainPendingWrites` which applies
  // them to the system sandbox after `seedAgentsMd` writes the
  // default AGENTS.md template. Empty strings are intentionally
  // skipped so a brand-new agent that hits Save without filling
  // either tab gets the default template untouched.
  //
  // Normalize newlines on the way in so the first thing on disk
  // matches the convention used by the update path's no-op diff.
  const identity = normalizeNewlines(input.identity).trim()
  if (identity.length > 0) {
    await enqueuePendingFileWrite({
      agentId: id,
      path: 'SOUL.md',
      content: identity,
    })
  }
  const instructions = normalizeNewlines(input.instructions).trim()
  if (instructions.length > 0) {
    await enqueuePendingFileWrite({
      agentId: id,
      path: 'AGENTS.md',
      content: instructions,
    })
  }

  // Boot the long-lived session immediately so a (possibly enabled)
  // heartbeat ticker starts producing runs without forcing the user
  // to chat or wait for the cron sweeper.
  try {
    await startAgentSession(created)
  } catch (err) {
    console.error('[v0] createAgentAction: startAgentSession failed', err)
  }

  updateTag(userAgentsTag(session.user.id))
  updateTag(agentTag(id))
  revalidatePath('/agents')
  revalidatePath('/')
  return { id }
}

interface UpdateInput {
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  id: string
  /**
   * SOUL.md content from the "Identity" tab. Empty string is a
   * legal value — it means "leave whatever is on disk alone". The
   * action only enqueues a pending write if the operator wrote
   * something AND it differs from the prefill that was rendered.
   */
  identity: string
  /** Original SOUL.md content the form was rendered with. */
  identityOriginal: string
  /** AGENTS.md content from the "Instructions" tab. */
  instructions: string
  /** Original AGENTS.md content the form was rendered with. */
  instructionsOriginal: string
  model: string
  name: string
  reflectionEnabled: boolean
  reflectionIntervalMinutes: number
}

export async function updateAgentAction(input: UpdateInput): Promise<void> {
  const session = await requireSession()
  const [existing] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, input.id), eq(agent.userId, session.user.id)))
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
      updatedAt: new Date(),
    })
    .where(eq(agent.id, input.id))
    .returning()

  // Persona files: only enqueue a pending write when the operator
  // actually edited the textarea. This keeps the queue from
  // ballooning with no-op rows when the user just changes the model
  // or the heartbeat interval.
  //
  // Both sides of the diff are normalized to LF so a `<Textarea>`
  // round-trip — which on Windows hosts can introduce or strip CRLF
  // pairs — doesn't manufacture a phantom edit. We persist the
  // normalized content so disk and queue agree on a single line-ending
  // convention forever.
  const identityNorm = normalizeNewlines(input.identity)
  const identityOrigNorm = normalizeNewlines(input.identityOriginal)
  if (identityNorm !== identityOrigNorm) {
    await enqueuePendingFileWrite({
      agentId: input.id,
      path: 'SOUL.md',
      content: identityNorm,
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
        '[v0] updateAgentAction: pokeHeartbeat after schedule change failed',
        err
      )
    }
  }

  updateTag(userAgentsTag(session.user.id))
  updateTag(agentTag(input.id))
  revalidatePath('/agents')
  revalidatePath(`/agents/${input.id}`)
  revalidatePath(`/agents/${input.id}/edit`)
  revalidatePath('/')
}

export async function toggleAgentAction(
  agentId: string,
  enabled: boolean
): Promise<void> {
  const session = await requireSession()
  const [existing] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))
    .limit(1)
  if (!existing) {
    return
  }

  const [updated] = await db
    .update(agent)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(agent.id, agentId))
    .returning()

  if (!existing.enabled && updated.enabled) {
    try {
      await startAgentSession(updated)
    } catch (err) {
      console.error('[v0] toggleAgentAction: startAgentSession failed', err)
    }
  } else if (existing.enabled && !updated.enabled) {
    await stopAgentSession(agentId)
  }

  updateTag(userAgentsTag(session.user.id))
  updateTag(agentTag(agentId))
  revalidatePath('/agents')
  revalidatePath(`/agents/${agentId}`)
  revalidatePath('/')
}

export async function deleteAgentAction(agentId: string): Promise<void> {
  const session = await requireSession()
  const [existing] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))
    .limit(1)
  if (!existing) {
    redirect('/agents')
  }

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
  revalidatePath('/agents')
  revalidatePath('/')
  redirect('/agents')
}
