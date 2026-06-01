import {
  isSubAgentToolOutput,
  subAgentModelText,
} from '@outname/ai/agent-runtime/server/sub-agent-tool-output'
import type { UIMessage } from 'ai'

export function compactSubAgentToolOutputsForModel(
  messages: UIMessage[]
): UIMessage[] {
  return messages.map((message) => {
    let changed = false
    const parts = message.parts.map((part) => {
      if (!isToolPartWithOutput(part)) {
        return part
      }
      if (!isSubAgentToolOutput(part.output)) {
        return part
      }
      changed = true
      return {
        ...part,
        output: subAgentModelText(part.output),
      } as UIMessage['parts'][number]
    })

    return changed ? { ...message, parts } : message
  })
}

function isToolPartWithOutput(
  part: UIMessage['parts'][number]
): part is UIMessage['parts'][number] & { output: unknown } {
  if (
    !(
      typeof part === 'object' &&
      part !== null &&
      'output' in part &&
      'state' in part &&
      part.state === 'output-available'
    )
  ) {
    return false
  }
  return (
    part.type === 'dynamic-tool' ||
    (typeof part.type === 'string' && part.type.startsWith('tool-'))
  )
}
