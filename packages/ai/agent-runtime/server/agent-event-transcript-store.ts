import 'server-only'
import type { AgentChatMessage } from '@outname/ai/agent-runtime/server/chat-status'
import { db } from '@outname/db'
import { agentEventMessage, agentEvents } from '@outname/db/schema'
import type { UIMessage } from 'ai'
import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm'

export async function listAgentEventTranscriptMessages(
  eventId: string
): Promise<AgentChatMessage[]> {
  const rows = await db
    .select()
    .from(agentEventMessage)
    .where(eq(agentEventMessage.eventId, eventId))
    .orderBy(asc(agentEventMessage.messageOrder))

  return rows.map((row) => {
    if (!isAgentChatMessageParts(row.parts)) {
      throw new Error(
        `Invalid transcript parts for event ${eventId} message ${row.messageId}`
      )
    }
    if (!isAgentChatMessageRole(row.role)) {
      throw new Error(
        `Invalid transcript role for event ${eventId} message ${row.messageId}`
      )
    }
    return {
      id: row.messageId,
      metadata: row.metadata ?? undefined,
      parts: row.parts,
      role: row.role,
    }
  })
}

export async function replaceAgentEventTranscriptMessages(input: {
  eventId: string
  messages: readonly UIMessage[]
  userId: string
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(agentEventMessage)
      .where(eq(agentEventMessage.eventId, input.eventId))

    if (input.messages.length === 0) {
      return
    }

    const createdAt = new Date()
    await tx.insert(agentEventMessage).values(
      input.messages.map((message, index) => ({
        createdAt,
        eventId: input.eventId,
        id: `${input.eventId}:${index}`,
        messageId: message.id,
        messageOrder: index,
        metadata: message.metadata ?? null,
        parts: message.parts,
        role: message.role,
        userId: input.userId,
      }))
    )
  })
}

export async function replaceAgentEventTranscriptMessagesBestEffort(input: {
  eventId: string
  messages: readonly UIMessage[]
  userId: string
}): Promise<void> {
  try {
    await replaceAgentEventTranscriptMessages(input)
  } catch (error) {
    console.error('[agent-events] failed to persist event transcript', {
      errorCode: 'AGENT_EVENT_TRANSCRIPT_PERSIST_FAILED',
      errorMessage:
        error instanceof Error ? error.message : 'unknown transcript error',
      eventId: input.eventId,
      messageCount: input.messages.length,
    })
  }
}

export interface DreamingTranscriptMessage {
  eventId: string
  messageId: string
  role: string
  text: string
}

export interface DreamingTranscriptEvent {
  completedAt: Date
  eventId: string
  messages: DreamingTranscriptMessage[]
  type: string
}

export async function listRecentCompletedAgentEventTranscriptsForDreaming(input: {
  agentId: string
  completedAfter: Date
  limit: number
  maxMessagesPerEvent: number
  userId: string
}): Promise<DreamingTranscriptEvent[]> {
  const eventRows = await db
    .select({
      completedAt: agentEvents.completedAt,
      eventId: agentEvents.id,
      type: agentEvents.type,
    })
    .from(agentEvents)
    .where(
      and(
        eq(agentEvents.agentId, input.agentId),
        eq(agentEvents.userId, input.userId),
        eq(agentEvents.status, 'completed'),
        inArray(agentEvents.type, ['heartbeat', 'invocation']),
        gte(agentEvents.completedAt, input.completedAfter)
      )
    )
    .orderBy(desc(agentEvents.completedAt))
    .limit(input.limit)

  const events: DreamingTranscriptEvent[] = []
  for (const event of eventRows) {
    if (!event.completedAt) {
      continue
    }
    const messageRows = await db
      .select({
        eventId: agentEventMessage.eventId,
        messageId: agentEventMessage.messageId,
        parts: agentEventMessage.parts,
        role: agentEventMessage.role,
      })
      .from(agentEventMessage)
      .where(eq(agentEventMessage.eventId, event.eventId))
      .orderBy(asc(agentEventMessage.messageOrder))
      .limit(input.maxMessagesPerEvent)
    events.push({
      completedAt: event.completedAt,
      eventId: event.eventId,
      messages: messageRows.flatMap((message) => {
        const text = extractTextFromParts(message.parts)
        return text
          ? [
              {
                eventId: message.eventId,
                messageId: message.messageId,
                role: message.role,
                text,
              },
            ]
          : []
      }),
      type: event.type,
    })
  }
  return events
}

function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) {
    return ''
  }
  const chunks: string[] = []
  for (const part of parts) {
    if (
      typeof part === 'object' &&
      part !== null &&
      Reflect.get(part, 'type') === 'text' &&
      typeof Reflect.get(part, 'text') === 'string'
    ) {
      chunks.push(Reflect.get(part, 'text') as string)
    }
  }
  return chunks.join('\n').trim()
}
function isAgentChatMessageRole(
  value: unknown
): value is AgentChatMessage['role'] {
  return value === 'assistant' || value === 'system' || value === 'user'
}

function isAgentChatMessagePart(
  value: unknown
): value is AgentChatMessage['parts'][number] {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'type') === 'string'
  )
}

function isAgentChatMessageParts(
  value: unknown
): value is AgentChatMessage['parts'] {
  return Array.isArray(value) && value.every(isAgentChatMessagePart)
}
