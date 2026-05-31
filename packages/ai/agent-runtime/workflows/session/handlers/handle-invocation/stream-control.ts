import { getWritable } from '@outname/workflow/runtime'
import type { UIMessage, UIMessageChunk } from 'ai'

export async function finishUiMessageStream(namespace: string): Promise<void> {
  'use step'
  const writable = getWritable<UIMessageChunk>({ namespace })
  const writer = writable.getWriter()
  try {
    await writer.write({ type: 'finish' })
  } finally {
    writer.releaseLock()
  }
  await writable.close()
}

export async function writeUiMessageStreamError(
  namespace: string,
  message: string
): Promise<void> {
  'use step'
  const writable = getWritable<UIMessageChunk>({ namespace })
  const writer = writable.getWriter()
  try {
    await writer.write({ type: 'error', errorText: message })
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
  const writable = getWritable<UIMessageChunk>({ namespace })
  const writer = writable.getWriter()
  const partId = `step_limit_${Math.random().toString(36).slice(2, 10)}`
  try {
    await writer.write({ type: 'text-start', id: partId })
    await writer.write({ type: 'text-delta', id: partId, delta: notice })
    await writer.write({ type: 'text-end', id: partId })
  } finally {
    writer.releaseLock()
  }
}

export function formatStepLimitStreamText(
  messages: readonly UIMessage[],
  notice: string
): string {
  const trimmedNotice = notice.trim()
  if (!trimmedNotice) {
    return ''
  }
  const lastMessage = messages.at(-1)
  const hasAssistantText =
    lastMessage?.role === 'assistant' &&
    lastMessage.parts.some(
      (part) => part.type === 'text' && part.text.trim().length > 0
    )
  return `${hasAssistantText ? '\n\n' : ''}${trimmedNotice}`
}
