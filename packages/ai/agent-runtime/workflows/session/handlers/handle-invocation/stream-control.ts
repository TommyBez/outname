import type { AgentModelCallChunk } from '@outname/ai/agent-runtime/server/chat-status'
import { getWritable } from '@outname/workflow/runtime'
import type { ModelMessage } from 'ai'

export async function finishModelCallStream(namespace: string): Promise<void> {
  'use step'
  const writable = getWritable<AgentModelCallChunk>({ namespace })
  await writable.close()
}

export async function writeModelCallStreamError(
  namespace: string,
  message: string
): Promise<void> {
  'use step'
  const writable = getWritable<AgentModelCallChunk>({ namespace })
  const writer = writable.getWriter()
  try {
    await writer.write({ type: 'error', error: message })
  } finally {
    writer.releaseLock()
  }
}

export async function writeAssistantNotice(
  namespace: string,
  notice: string
): Promise<void> {
  'use step'
  if (!notice) {
    return
  }
  const writable = getWritable<AgentModelCallChunk>({ namespace })
  const writer = writable.getWriter()
  const partId = `step_limit_${Math.random().toString(36).slice(2, 10)}`
  try {
    await writer.write({ type: 'text-start', id: partId })
    await writer.write({ type: 'text-delta', id: partId, text: notice })
    await writer.write({ type: 'text-end', id: partId })
  } finally {
    writer.releaseLock()
  }
}

export function formatStepLimitStreamText(
  messages: readonly ModelMessage[],
  notice: string
): string {
  const trimmedNotice = notice.trim()
  if (!trimmedNotice) {
    return ''
  }
  const lastMessage = messages.at(-1)
  const hasAssistantText =
    lastMessage?.role === 'assistant' &&
    hasModelMessageText(lastMessage.content)
  return `${hasAssistantText ? '\n\n' : ''}${trimmedNotice}`
}

function hasModelMessageText(content: ModelMessage['content']): boolean {
  if (typeof content === 'string') {
    return content.trim().length > 0
  }
  if (!Array.isArray(content)) {
    return false
  }
  return content.some(
    (part) => part.type === 'text' && part.text.trim().length > 0
  )
}
