import { tool } from 'ai'
import { createHook } from 'workflow'
import { z } from 'zod'
import { dispatchInvocation } from '@/lib/agent-session'
import type { SubAgentReply } from '@/workflows/agent-session/events'

export interface AgentToolHandle {
  /** Child agent's row data, already vetted by resolveToolPlan. */
  childAgentId: string
  childName: string
  childUserId: string
  /** Agent currently executing the tool. */
  parentAgentId: string
  /**
   * Parent's call stack at build time. We append the current parent id
   * before dispatching so the child sees the full lineage and can
   * refuse a cycle even if our own check missed.
   */
  parentCallStack: string[]
  /** Parent's nesting depth. The child runs at parentDepth + 1. */
  parentDepth: number
  /** App run id for the parent, when the parent itself is a run. */
  parentRunId: string | null
  /** Synthesised tool key that triggered the invocation. */
  parentToolId: string
  /** Parent user — must equal childUserId; resolveToolPlan enforces. */
  parentUserId: string
}

/**
 * Phase 4: synthesises an AI-SDK tool that lets a parent agent
 * delegate work to one of its own sub-agents.
 *
 * The model sees a tool named `agent_<childId>` (or rather, the
 * AI-SDK key we register it under) with one input — `instruction` —
 * and a string return. From the model's perspective this is just
 * another awaited tool call; behind the scenes:
 *
 *   1. We allocate a unique `replyTo` token.
 *   2. We open a one-shot `createHook` on that token. This blocks the
 *      parent's `execute()` durably inside the workflow VM — no
 *      busy-waiting, no polling, survives platform-level resumes.
 *   3. We dispatch an `invocation` SessionEvent to the child agent's
 *      session workflow via `dispatchInvocation`.
 *   4. The child's `handleInvocation` calls `resumeHook(replyTo, ...)`
 *      with the reply payload.
 *   5. Our hook iterator yields the reply and we either return its
 *      `output` to the model or throw its `error` so the SDK can
 *      surface it as a tool error.
 *
 * Cycle and depth enforcement happens earlier (resolveToolPlan); this
 * function trusts its caller.
 */
export function buildAgentTool(handle: AgentToolHandle) {
  const description = composeDescription(handle)

  return tool({
    description,
    inputSchema: z.object({
      instruction: z
        .string()
        .min(1)
        .max(8000)
        .describe(
          [
            'A self-contained task description for the sub-agent.',
            'Include all context the sub-agent needs — it does not see',
            'the parent conversation or memory. Reply will be plain',
            'text returned as the tool result.',
          ].join(' ')
        ),
    }),
    execute: async ({ instruction }) => {
      const replyTo = newReplyToken()

      // IMPORTANT: open the hook BEFORE dispatching, otherwise the
      // child's resumeHook can race ahead of us and the reply is lost.
      const hook = createHook<SubAgentReply>({ token: replyTo })

      await dispatchSubAgentInvocation({
        handle,
        instruction,
        replyTo,
      })

      // One-shot consumption: take the first event off the hook, then
      // we're done. The hook's lifecycle ends with the iteration —
      // workflow GC reclaims the token automatically.
      for await (const reply of hook) {
        if (reply.type !== 'reply') {
          continue
        }
        if (reply.ok) {
          return reply.output
        }
        throw new Error(`sub-agent failed: ${reply.error}`)
      }

      throw new Error('sub-agent reply hook closed without a reply')
    },
  })
}

async function dispatchSubAgentInvocation(input: {
  handle: AgentToolHandle
  instruction: string
  replyTo: string
}): Promise<void> {
  'use step'
  const { handle, instruction, replyTo } = input
  await dispatchInvocation({
    childAgentId: handle.childAgentId,
    childUserId: handle.childUserId,
    parentUserId: handle.parentUserId,
    parentRunId: handle.parentRunId,
    parentToolId: handle.parentToolId,
    instruction,
    replyTo,
    callStack: [...handle.parentCallStack, handle.parentAgentId],
    depth: handle.parentDepth + 1,
  })
}

function composeDescription(handle: AgentToolHandle): string {
  return (
    `Delegate a task to your sub-agent "${handle.childName}". ` +
    'Provide a fully self-contained instruction; the sub-agent does ' +
    'not see your conversation, memory, or files unless you include ' +
    "them in the instruction. Returns the sub-agent's final text reply."
  )
}

function newReplyToken(): string {
  return (
    'inv_reply_' +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  )
}
