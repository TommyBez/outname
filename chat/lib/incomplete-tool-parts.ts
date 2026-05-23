import { isToolUIPart, type UIMessage } from 'ai'

const INCOMPLETE_TOOL_STATES = new Set([
  'input-streaming',
  'input-available',
  'approval-requested',
])

export function isIncompleteToolPart(
  part: UIMessage['parts'][number]
): boolean {
  if (!isToolUIPart(part)) {
    return false
  }
  return INCOMPLETE_TOOL_STATES.has(part.state)
}

/**
 * Drop tool parts that never finished so the model (and AI SDK validation)
 * do not see orphaned tool calls after an aborted or failed stream.
 */
export function stripIncompleteToolPartsForModel<T extends UIMessage>(
  messages: T[]
): T[] {
  return messages.flatMap((message) => {
    const parts = message.parts.filter((part) => !isIncompleteToolPart(part))
    if (parts.length === 0) {
      return []
    }
    if (parts.length === message.parts.length) {
      return [message]
    }
    return [{ ...message, parts } as T]
  })
}
