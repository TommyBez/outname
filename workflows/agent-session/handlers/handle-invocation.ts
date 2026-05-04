import { convertToModelMessages, type UIMessage, type UIMessageChunk } from 'ai'
import { getWorkflowMetadata, getWritable } from 'workflow'
import { resumeHook } from 'workflow/api'
import { startupExecSandbox, startupSystemSandbox } from '@/lib/agent-sandbox'
import { emitActivity, emitRun, emitStep } from '@/lib/run-events'
import { buildAgent } from '../agent-factory'
import type { SubAgentReply } from '../events'
import {
  appendStepLimitNoticeToOutput,
  buildStepLimitNotice,
  didReachStepLimit,
  resolveStepLimit,
  resolveStepLimitCount,
} from '../step-limit'
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
 *   - Uses the child workflow runtime id for breadcrumbs and source
 *     attribution. Phase 5 removed the legacy `runs` table.
 *   - Streams to that workflow runtime id, matching heartbeat events.
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
}): Promise<{ pending: PendingWrites; runId: string }> {
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

  const writable = getWritable<UIMessageChunk>({ namespace: runId })

  let pending: PendingWrites = createPendingWrites()
  let replied = false

  try {
    await emitRun(runId, 'started', 'Sub-agent invocation started', {
      parentRunId: parentRunId ?? null,
      parentToolId: parentToolId ?? null,
    })
    await emitActivity(runId, 'Sub-agent: Preparing invocation', {
      depth,
      parentRunId: parentRunId ?? null,
    })
    await startupSystemSandbox({ agentId })
    await startupExecSandbox({ agentId }).catch((err) => {
      console.error('[v0] handleInvocation: startupExecSandbox failed', err)
    })
    await emitActivity(runId, 'Sub-agent: Syncing memory edits')
    await drainPendingWrites({ agentId })

    const built = await buildAgent({
      agentId,
      runId,
      currentRunId: runId,
      callStack,
      depth,
    })
    pending = built.pending
    await emitActivity(runId, 'Sub-agent: Streaming model work', {
      model: built.meta.model,
    })
    const stepLimitInput = {
      mode: built.meta.stepLimitMode,
      custom: built.meta.stepLimitCustom,
    } as const

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
      stopWhen: resolveStepLimit(stepLimitInput),
      collectUIMessages: true,
    })
    const hitStepLimit = didReachStepLimit({
      ...stepLimitInput,
      steps: result.steps,
    })
    if (hitStepLimit) {
      await emitActivity(
        runId,
        'Sub-agent: Step limit reached, finalizing early',
        {
          stepLimit: resolveStepLimitCount(stepLimitInput),
        }
      )
    }
    await emitStep(
      runId,
      'read',
      'done',
      hitStepLimit
        ? 'Sub-agent instruction reached the step limit'
        : 'Sub-agent instruction completed'
    )

    const baseOutput = extractFinalText(result.uiMessages ?? []) ?? ''
    const output = hitStepLimit
      ? appendStepLimitNoticeToOutput(
          baseOutput,
          buildStepLimitNotice(stepLimitInput)
        )
      : baseOutput
    await emitActivity(runId, 'Sub-agent: Finalizing reply')
    await emitRun(
      runId,
      'completed',
      hitStepLimit
        ? 'Sub-agent invocation completed after reaching the step limit'
        : 'Sub-agent invocation completed'
    )
    await replyOnce(replyTo, { type: 'reply', ok: true, output })
    replied = true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    try {
      await emitActivity(runId, 'Sub-agent: Invocation failed', { message })
      await emitStep(runId, 'read', 'error', message)
      await emitRun(runId, 'failed', message)
    } catch (innerErr) {
      console.error(
        '[v0] handleInvocation: failed to emit failure breadcrumbs',
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

  return { pending, runId }
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
  await Promise.resolve()
  return currentWorkflowRunId(input)
}

function currentWorkflowRunId(input: {
  agentId: string
  replyTo: string
}): string {
  try {
    const metadata = getWorkflowMetadata() as {
      runId?: string
      workflowRunId?: string
    }
    const runId = metadata.runId ?? metadata.workflowRunId
    if (runId) {
      return runId
    }
  } catch {
    // Outside a workflow context, keep a deterministic local fallback.
  }
  return input.replyTo
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
