import { convertToModelMessages, type UIMessage, type UIMessageChunk } from 'ai'
import { eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { getWorkflowMetadata, getWritable } from 'workflow'
import { resumeHook } from 'workflow/api'
import { startupExecSandbox, startupSystemSandbox } from '@/lib/agent-sandbox'
import { agentRunsTag, runsIndexTag, runTag } from '@/lib/cache-tags'
import { db } from '@/lib/db'
import { runs } from '@/lib/db/schema'
import { emitRun, emitStep } from '@/lib/run-events'
import { buildAgent } from '../agent-factory'
import type { SubAgentReply } from '../events'
import { drainPendingWrites } from '../steps/drain-pending-writes'
import {
  createPendingWrites,
  type PendingWrites,
} from '../tools/pending-writes'

/**
 * Phase 4: invocation event handler — runs inside the **child**
 * agent's session workflow when a parent agent's `agent_<childId>`
 * tool call dispatches an `invocation` event onto its hook.
 *
 * Mirrors `handleChat` shape with key differences:
 *
 *   - No `conversationId` and no chat-message persistence — the
 *     parent's tool call IS the unit of conversation, not a UI thread.
 *   - Allocates its own `runs` row so sub-agent calls show up in
 *     `/runs/...` for observability and the existing
 *     `/api/runs/[runId]/stream` route can replay this run's chunks.
 *   - Streams to a per-invocation namespace keyed by `replyTo` so a
 *     specific call's chunks are easy to isolate.
 *   - Calls `resumeHook(replyTo, { type: 'reply', ... })` exactly
 *     once at the end, success or failure, so the parent's
 *     `createHook` inside its `agent_<child>` tool's `execute()` is
 *     guaranteed to unblock. The parent must never deadlock waiting
 *     on us.
 *
 * Returns the per-event `pending` queue so the session loop can pass
 * it to `endOfEvent`, exactly like `handleChat`.
 */
export async function handleInvocation(input: {
  agentId: string
  /** Parent's free-text instruction. Plays the role of the user turn. */
  input: string
  /** Ephemeral hook token the parent's `execute()` is awaiting on. */
  replyTo: string
  parentRunId?: string | null
  parentToolId?: string | null
  callStack: string[]
  depth: number
}): Promise<{ pending: PendingWrites }> {
  const {
    agentId,
    input: instruction,
    replyTo,
    parentRunId,
    parentToolId,
    callStack,
    depth,
  } = input

  const runId = await beginInvocationRun({
    agentId,
    parentRunId: parentRunId ?? null,
    parentToolId: parentToolId ?? null,
    replyTo,
  })

  const writable = getWritable<UIMessageChunk>({
    namespace: `invocation:${replyTo}`,
  })

  let pending: PendingWrites = createPendingWrites()
  let replied = false

  try {
    await emitRun(runId, 'started', 'Sub-agent invocation started', {
      parentRunId: parentRunId ?? null,
      parentToolId: parentToolId ?? null,
    })
    await startupSystemSandbox({ agentId })
    await startupExecSandbox({ agentId }).catch((err) => {
      console.error('[v0] handleInvocation: startupExecSandbox failed', err)
    })
    await drainPendingWrites({ agentId })

    const built = await buildAgent({
      agentId,
      runId,
      currentRunId: runId,
      callStack,
      depth,
    })
    pending = built.pending

    const userMessage: UIMessage = {
      id: invocationMessageId(),
      role: 'user',
      parts: [{ type: 'text', text: instruction }],
    }
    const modelMessages = await convertToModelMessages([userMessage])

    await emitStep(runId, 'read', 'start', 'Running sub-agent instruction')
    const result = await built.agent.stream({
      messages: modelMessages,
      writable,
      maxSteps: 40,
      collectUIMessages: true,
    })
    await emitStep(runId, 'read', 'done', 'Sub-agent instruction completed')

    const output = extractFinalText(result.uiMessages ?? []) ?? ''
    await finalizeInvocationRun({ runId, status: 'completed' })
    await emitRun(runId, 'completed', 'Sub-agent invocation completed')
    await replyOnce(replyTo, { type: 'reply', ok: true, output })
    replied = true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    try {
      await emitStep(runId, 'read', 'error', message)
      await finalizeInvocationRun({ runId, status: 'failed', error: message })
      await emitRun(runId, 'failed', message)
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
    // Re-throw so the session loop logs it just like a chat-handler
    // failure. The parent has already received a structured reply, so
    // re-throwing here doesn't risk a deadlock.
    throw err
  }

  return { pending }
}

async function replyOnce(
  replyTo: string,
  payload: SubAgentReply
): Promise<void> {
  'use step'
  try {
    await resumeHook(replyTo, payload)
  } catch (err) {
    // resumeHook can fail if the parent's hook expired; we log and
    // move on — the parent's `execute()` will then time out on its
    // own bound. Either way the child's run record is finalized.
    console.error('[v0] handleInvocation: resumeHook failed', err)
  }
}

async function beginInvocationRun(input: {
  agentId: string
  parentRunId: string | null
  parentToolId: string | null
  replyTo: string
}): Promise<string> {
  'use step'
  const runId = invocationRunId()

  let workflowRunId: string | null = null
  try {
    workflowRunId = getWorkflowMetadata().workflowRunId
  } catch {
    // Outside a workflow context — leave null.
  }

  await db.insert(runs).values({
    id: runId,
    agentId: input.agentId,
    status: 'running',
    startedAt: new Date(),
    workflowRunId,
    parentRunId: input.parentRunId,
    parentToolId: input.parentToolId,
    invocationReplyToken: input.replyTo,
  })

  revalidateTag(agentRunsTag(input.agentId), 'max')
  revalidateTag(runsIndexTag(), 'max')
  if (input.parentRunId) {
    revalidateTag(runTag(input.parentRunId), 'max')
  }

  return runId
}

async function finalizeInvocationRun(input: {
  runId: string
  status: 'completed' | 'failed'
  error?: string
}): Promise<void> {
  'use step'
  const [row] = await db
    .update(runs)
    .set({
      status: input.status,
      completedAt: new Date(),
      error: input.error?.slice(0, 8000) ?? null,
    })
    .where(eq(runs.id, input.runId))
    .returning({ agentId: runs.agentId })

  if (row?.agentId) {
    revalidateTag(agentRunsTag(row.agentId), 'max')
  }
  revalidateTag(runTag(input.runId), 'max')
  revalidateTag(runsIndexTag(), 'max')
}

function invocationRunId(): string {
  return (
    'inv_' +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  )
}

function invocationMessageId(): string {
  return `inv_msg_${Math.random().toString(36).slice(2, 10)}`
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
