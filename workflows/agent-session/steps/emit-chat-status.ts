import type { UIMessageChunk } from 'ai'
import { getWritable } from 'workflow'
import {
  CHAT_STATUS_PART_ID,
  CHAT_STATUS_PART_TYPE,
  type ChatStatusPhase,
} from '@/lib/agent-chat-status'

export async function emitChatStatus(input: {
  message: string
  phase: ChatStatusPhase
  replyToken: string
}): Promise<void> {
  'use step'

  try {
    const writable = getWritable<UIMessageChunk>({
      namespace: input.replyToken,
    })
    const writer = writable.getWriter()
    try {
      await writer.write({
        type: CHAT_STATUS_PART_TYPE,
        id: CHAT_STATUS_PART_ID,
        data: {
          message: input.message,
          phase: input.phase,
          timestamp: new Date().toISOString(),
        },
        transient: true,
      })
    } finally {
      writer.releaseLock()
    }
  } catch {
    // Status updates are purely UX hints; never fail a chat turn for them.
  }
}
