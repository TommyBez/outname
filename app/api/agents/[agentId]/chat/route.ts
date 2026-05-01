import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { revalidateTag } from 'next/cache'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { getRun } from 'workflow/api'
import {
  getOrCreateConversationForAgent,
  insertChatMessage,
} from '@/lib/agent-chat'
import {
  type AgentChatChunk,
  type AgentChatMessage,
  CHAT_STATUS_PART_ID,
  CHAT_STATUS_PART_TYPE,
} from '@/lib/agent-chat-status'
import { dispatchChatTurn } from '@/lib/agent-session'
import { auth } from '@/lib/auth'
import { conversationListTag } from '@/lib/cache-tags'
import type { ChatRole } from '@/lib/db/schema'
import { getAgentById } from '@/lib/start-agent-run'

/**
 * POST /api/agents/[agentId]/chat
 *
 * Single-turn chat endpoint. The client sends the full UIMessage history
 * (see `workflow-chat-transport`'s default shape). We:
 *
 *   1. Authenticate and authorize against the agent's owner.
 *   2. Verify the agent is enabled.
 *   3. Resolve or create the single conversation for this agent.
 *   4. Persist the just-sent user message so the history row survives
 *      even if the workflow fails mid-stream.
 *   5. Dispatch the turn into the agent's long-lived session workflow.
 *      The session writes its `UIMessageChunk` reply into a per-turn
 *      namespaced sub-stream of its run, keyed by `replyToken`. We
 *      pipe that sub-stream straight into
 *      `createUIMessageStreamResponse` so `useChat` sees the same
 *      shape it always has.
 *
 * The workflow itself persists the assistant turn after streaming
 * completes — see `workflows/chat/steps/persist-assistant-turn.ts`.
 *
 * Phase 2 dropped the per-kind chat gate (every agent is generic).
 * Phase 3 introduced `user_connections` + `agent_tools`: per-tool
 * credential resolution now happens inside the workflow's boot step
 * (`workflows/agent-session/steps/resolve-tool-plan.ts`), and tools
 * that fail to resolve are surfaced as a "Tools needing reconnection"
 * block in the system prompt rather than failing the chat round-trip.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { agentId } = await params
  const agent = await getAgentById(agentId)
  if (!agent || agent.userId !== session.user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  if (!agent.enabled) {
    return NextResponse.json(
      { error: 'Agent is paused. Enable it before chatting.' },
      { status: 412 }
    )
  }

  let body: { messages?: AgentChatMessage[]; conversationId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const uiMessages = body.messages ?? []
  if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }

  const requestedConversationId = body.conversationId
  if (
    typeof requestedConversationId !== 'string' ||
    requestedConversationId.length < 3 ||
    requestedConversationId.length > 64
  ) {
    return NextResponse.json(
      { error: 'conversationId required' },
      { status: 400 }
    )
  }

  const conversation = await getOrCreateConversationForAgent(
    requestedConversationId,
    agentId
  )
  if (!conversation) {
    return NextResponse.json(
      { error: 'conversation not found' },
      { status: 404 }
    )
  }
  const conversationId = conversation.id

  const last = uiMessages.at(-1)
  if (last && last.role === 'user') {
    await insertChatMessage({
      conversationId,
      id: last.id,
      role: last.role as ChatRole,
      parts: last.parts,
      metadata: last.metadata,
    })
    revalidateTag(conversationListTag(agent.id), 'max')
  }

  const stream = createUIMessageStream<AgentChatMessage>({
    async execute({ writer }) {
      writer.write({
        type: CHAT_STATUS_PART_TYPE,
        id: CHAT_STATUS_PART_ID,
        data: {
          message: 'Starting workflow session...',
          phase: 'workflow-session',
          timestamp: new Date().toISOString(),
        },
        transient: true,
      })

      const { sessionRunId, replyToken } = await dispatchChatTurn({
        agent,
        conversationId,
        uiMessages,
      })

      // Subscribe to the per-turn namespaced sub-stream of the session run.
      // The session's `handleChat` writes `UIMessageChunk`s into this same
      // namespace; the AI SDK helper repacks them into `useChat`'s
      // expected shape.
      const readable = getRun(sessionRunId).getReadable<AgentChatChunk>({
        namespace: replyToken,
      })
      writer.merge(readable)
    },
  })

  return createUIMessageStreamResponse({
    stream,
  })
}
