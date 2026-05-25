import { revalidateTag } from 'next/cache'
import { headers } from 'next/headers'
import { after, type NextRequest, NextResponse } from 'next/server'
import type { AgentChatMessage } from '@/agent-runtime/server/chat-status'
import { runRealtimeChatTurn } from '@/agent-runtime/server/realtime-chat-runner'
import { getAgentById } from '@/agent-runtime/server/start-agent-run'
import { auth } from '@/auth/server/auth'
import {
  getOrCreateConversationForAgent,
  insertChatMessage,
} from '@/chat/server/chat'
import type { ChatRole } from '@/shared/db/schema'
import { ensureUserAiGatewayApiKey } from '@/shared/server/ai-gateway-http'
import { conversationListTag } from '@/shared/server/cache-tags'

// Authenticate, persist the newest user turn, then stream a realtime
// ToolLoopAgent response back into `useChat`.
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

  const missingKey = await ensureUserAiGatewayApiKey(session.user.id)
  if (missingKey) {
    return missingKey
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

  return await runRealtimeChatTurn({
    abortSignal: req.signal,
    agentId,
    conversationId,
    delivery: {
      scheduleBackgroundTask(task) {
        after(task)
      },
    },
    messages: uiMessages,
    persistMode: 'ui-message-full',
    runId: `rt_${crypto.randomUUID()}`,
    source: 'chat',
    userId: agent.userId,
  })
}
