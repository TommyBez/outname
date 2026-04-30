import type { UIMessage, UIMessageChunk } from 'ai'
import { eq } from 'drizzle-orm'
import { getWritable } from 'workflow'
import { resumeHook } from 'workflow/api'
import { startupExecSandbox, startupSystemSandbox } from '@/lib/agent-sandbox'
import { db } from '@/lib/db'
import { runs } from '@/lib/db/schema'
import { buildAgent } from '../agent-factory'
import { drainPendingWrites } from '../steps/drain-pending-writes'
import type { SubAgentReply } from '../events'
import { type PendingWrites, createPendingWrites } from '../tools/pending-writes'

/**
 * Phase 4: invocation event handler — runs inside the child agent's
 * long-lived session workflow when a parent agent calls it via
 * `agent_<childId>`.
 *
 * Mirrors `handleChat` shape with key differences:
 *
 *   - No `conversationId`, no chat-message persistence — the parent's
 *     tool call is the unit of conversation, not a UI thread.
 *   - Allocates its own `runs` row for observability so sub-agent
 *     calls show up as linked workflow runs.
 *   - Streams to a per-invocation namespace keyed by `replyTo` so we
 *     can debug a specific call without trawling the session's
 *     general stream.
 *   - Calls `resumeHook(replyTo, { type: 'reply', ... })` exactly
 *     once at the end so the parent's `createHook` inside its tool's
 *     `execute()` unblocks. Errors also send a failure reply — the
 *     parent must never deadlock waiting on us.
 *
 * Returns the per-event `pending` queue exactly like `handleChat`.
 */
export async function handleInvocation(input: {
  agentId: string
  instruction: string
  replyTo: string
  callStack: string[]
  depth: number
}): Promise<{ pending: PendingWrites }> {
  const { agentId, instruction, replyTo, callStack, depth } = input

  const runId = await beginInvocationRun({ agentId })

  const writable = getWritable<UIMessageChunk>({
    namespace: `invocation:${replyTo}`,
  })

  let pending: PendingWrites = createPendingWrites()
  let replied = false
  try {
    await startupSystemSandbox({ agentId })
    await startupExecSandbox({ agentId }).catch((err) => {
      console.error('[v0] handleInvocation: startupExecSandbox failed', err)
    })
    await drainPendingWrites({ agentId })

    const built = await buildAgent({
      agentId,
      runId,
      callStack,
      depth,
    })
    pending = built.pending

    const userMessage: UIMessage = {
      id: `inv_${Math.random().toString(36).slice(2, 10)}`,
      role: 'user',
      parts: [{ type: 'text', text: instruction }],
    }

    const result = await built.agent.stream({
      messages: [{ role: 'user', content: instruction }],
      writable,
      maxSteps: 40,
      collectUIMessages: true,
    })

    const output = extractFinalText(result.uiMessages ?? []) ?? ''
    await finalizeInvocationRun({ runId, status: 'completed' })
    await replyOnce(replyTo, { type: 'reply', ok: true, output })
    replied = true

    // userMessage is intentionally referenced so the linter knows we
    // built it for parity with future logging/tracing — keep the
    // shape stable now to avoid churn later.
    void userMessage
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    try {
      await finalizeInvocationRun({ runId, status: 'failed', error: message })
    } catch (innerErr) {
      console.error(
        '[v0] handleInvocation: finalizeInvocationRun(failed) failed',
        innerErr
      )
    }
    if (!replied) {
      await replyOnce(replyTo, { type: 'reply', ok: false, error: message })
      replied = true
    }
    throw err
  }

  return { pending }
}

async function replyOnce(
  replyTo: string,
  payload: SubAgentReply
): Promise<void> {
  try {
    await resumeHook(replyTo, payload)
  } catch (err) {
    console.error('[v0] handleInvocation: resumeHook failed', err)
  }
}

async function beginInvocationRun(input: {
  agentId: string
}): Promise<string> {
  'use step'
  const runId = nanoid()
  await db.insert(runs).values({
    id: runId,
    agentId: input.agentId,
    status: 'running',
    startedAt: new Date(),
  })
  return runId
}

async function finalizeInvocationRun(input: {
  runId: string
  status: 'completed' | 'failed'
  error?: string
}): Promise<void> {
  'use step'
  await db
    .update(runs)
    .set({
      status: input.status,
      completedAt: new Date(),
      error: input.error?.slice(0, 8_000) ?? null,
    })
    .where(eq(runs.id, input.runId))
}

function nanoid(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  )
}

/**
 * Pull the assistant's final textual answer out of the AI-SDK UI
 * messages emitted during streaming. The sub-agent contract is "one
 * instruction in, one text reply out" — we collect all assistant
 * text parts from the final assistant message, joined.
 */
function extractFinalText(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'assistant') {
      continue
    }
    const chunks: string[] = []
    for (const part of m.parts ?? []) {
      if (part.type === 'text' && typeof part.text === 'string') {
        chunks.push(part.text)
      }
    }
    if (chunks.length > 0) {
      return chunks.join('').trim()
    }
  }
  return null
}
