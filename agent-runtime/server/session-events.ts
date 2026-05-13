import 'server-only'
import type { UIMessage, UIMessageChunk } from 'ai'
import { eq } from 'drizzle-orm'
import { getHookByToken, resumeHook } from 'workflow/api'
import {
  type SessionEvent,
  sessionToken,
} from '@/agent-runtime/workflows/session/events'
import { db } from '@/shared/db'
import { type Agent, agent } from '@/shared/db/schema'
import {
  isWorkflowRunAlive,
  restartAgentSession,
  sleep,
  startAgentSession,
} from './session-lifecycle'

const SESSION_HOOK_READY_TIMEOUT_MS = 5000
const SESSION_HOOK_POLL_MS = 100

function newReplyToken() {
  return (
    'rep_' +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  )
}

export async function pokeHeartbeat(opts: {
  agent: Agent
}): Promise<{ sessionRunId: string }> {
  return await resumeSessionEvent(opts.agent, {
    type: 'heartbeat',
    mode: 'normal',
    manual: true,
    scheduledAt: new Date().toISOString(),
  })
}

export async function pokeDreaming(opts: {
  agent: Agent
  localDate: string
}): Promise<{ sessionRunId: string }> {
  return await resumeSessionEvent(opts.agent, {
    type: 'dreaming',
    localDate: opts.localDate,
    manual: true,
    scheduledAt: new Date().toISOString(),
  })
}

export async function dispatchChatTurn(opts: {
  agent: Agent
  conversationId: string
  uiMessages: UIMessage[]
}): Promise<{ sessionRunId: string; replyToken: string }> {
  const replyToken = newReplyToken()
  const { sessionRunId } = await resumeSessionEvent(opts.agent, {
    type: 'chat',
    conversationId: opts.conversationId,
    uiMessages: opts.uiMessages,
    replyToken,
  })
  return { sessionRunId, replyToken }
}

export async function dispatchInvocation(input: {
  childAgentId: string
  childUserId: string
  parentUserId: string
  parentRunId: string | null
  parentToolId: string
  parentToolCallId?: string | null
  parentStream?: WritableStream<UIMessageChunk> | null
  instruction: string
  streamToken: string
  callStack: string[]
  depth: number
}): Promise<{ sessionRunId: string }> {
  if (input.childUserId !== input.parentUserId) {
    throw new Error(
      `dispatchInvocation: child ${input.childAgentId} does not belong to caller`
    )
  }

  const [child] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, input.childAgentId))
    .limit(1)
  if (!child) {
    throw new Error(`dispatchInvocation: child ${input.childAgentId} not found`)
  }
  if (!child.enabled) {
    throw new Error(
      `dispatchInvocation: child ${input.childAgentId} is disabled`
    )
  }

  const { sessionRunId } = await resumeSessionEvent(child, {
    type: 'invocation',
    input: input.instruction,
    streamToken: input.streamToken,
    parentRunId: input.parentRunId,
    parentToolId: input.parentToolId,
    parentToolCallId: input.parentToolCallId ?? null,
    parentStream: input.parentStream ?? null,
    callStack: input.callStack,
    depth: input.depth,
  })
  return { sessionRunId }
}

function isHookNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.name === 'HookNotFoundError'
}

async function waitForSessionHook(
  agentId: string,
  sessionEpoch: number,
  sessionRunId: string
): Promise<boolean> {
  const token = sessionToken(agentId, sessionEpoch)
  const deadlineMs = Date.now() + SESSION_HOOK_READY_TIMEOUT_MS

  while (Date.now() < deadlineMs) {
    try {
      const hook = await getHookByToken(token)
      if (hook.runId === sessionRunId) {
        return true
      }
    } catch (err) {
      if (!isHookNotFoundError(err)) {
        throw err
      }
    }

    if (!(await isWorkflowRunAlive(sessionRunId))) {
      return false
    }
    await sleep(SESSION_HOOK_POLL_MS)
  }

  return false
}

async function resumeSessionEvent(
  a: Agent,
  event: SessionEvent
): Promise<{ sessionRunId: string }> {
  let { sessionEpoch, sessionRunId } = await readySession(a)
  try {
    await resumeHook(sessionToken(a.id, sessionEpoch), event)
    return { sessionRunId }
  } catch (err) {
    if (!isHookNotFoundError(err)) {
      throw err
    }
  }

  console.warn('[v0] agent session hook disappeared; restarting session', {
    agentId: a.id,
    sessionRunId,
  })

  ;({ sessionEpoch, sessionRunId } = await restartAgentSession(a))
  if (!(await waitForSessionHook(a.id, sessionEpoch, sessionRunId))) {
    throw new Error(
      `Session hook for agent ${a.id} was not ready after recovery restart (${sessionRunId}).`
    )
  }

  await resumeHook(sessionToken(a.id, sessionEpoch), event)
  return { sessionRunId }
}

async function readySession(
  a: Agent
): Promise<{ sessionEpoch: number; sessionRunId: string }> {
  let { sessionEpoch, sessionRunId } = await startAgentSession(a)
  if (await waitForSessionHook(a.id, sessionEpoch, sessionRunId)) {
    return { sessionEpoch, sessionRunId }
  }

  console.warn('[v0] agent session hook was not ready; restarting session', {
    agentId: a.id,
    sessionRunId,
  })

  ;({ sessionEpoch, sessionRunId } = await restartAgentSession(a))
  if (await waitForSessionHook(a.id, sessionEpoch, sessionRunId)) {
    return { sessionEpoch, sessionRunId }
  }

  throw new Error(
    `Session hook for agent ${a.id} was not ready after restart (${sessionRunId}).`
  )
}
