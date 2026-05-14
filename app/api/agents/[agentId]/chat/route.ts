import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { revalidateTag } from 'next/cache'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { getRun } from 'workflow/api'
import {
  type AgentChatChunk,
  type AgentChatMessage,
  CHAT_STATUS_PART_ID,
  CHAT_STATUS_PART_TYPE,
} from '@/agent-runtime/server/chat-status'
import { dispatchChatTurn } from '@/agent-runtime/server/session-events'
import { getAgentById } from '@/agent-runtime/server/start-agent-run'
import { auth } from '@/auth/server/auth'
import {
  getOrCreateConversationForAgent,
  insertChatMessage,
} from '@/chat/server/chat'
import type { ChatRole } from '@/shared/db/schema'
import { conversationListTag } from '@/shared/server/cache-tags'

// Authenticate, persist the newest user turn, dispatch into an event workflow,
// then pipe the per-turn reply stream back into `useChat`.
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
          message: 'Starting agent event...',
          phase: 'agent-event',
          timestamp: new Date().toISOString(),
        },
        transient: true,
      })

      const { sessionRunId, replyToken } = await dispatchChatTurn({
        agent,
        conversationId,
        uiMessages,
      })
      if (!sessionRunId) {
        writer.write({
          type: CHAT_STATUS_PART_TYPE,
          id: CHAT_STATUS_PART_ID,
          data: {
            message: 'Agent event queued...',
            phase: 'agent-event',
            timestamp: new Date().toISOString(),
          },
          transient: true,
        })
        return
      }

      // `handleChat` writes `UIMessageChunk`s into this reply-token namespace.
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
