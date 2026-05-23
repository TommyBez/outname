import 'server-only'
import type { UIMessage } from 'ai'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { agentEventMessage } from '@/shared/db/schema'

export async function listAgentEventTranscriptMessages(
  eventId: string
): Promise<UIMessage[]> {
  const rows = await db
    .select()
    .from(agentEventMessage)
    .where(eq(agentEventMessage.eventId, eventId))
    .orderBy(asc(agentEventMessage.messageOrder))

  return rows.map((row) => ({
    id: row.messageId,
    metadata: row.metadata ?? undefined,
    parts: row.parts as UIMessage['parts'],
    role: row.role as UIMessage['role'],
  }))
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
