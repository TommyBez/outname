import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'
import { prepareChatMessagesForModel } from './chat-model'

describe('prepareChatMessagesForModel', () => {
  it('strips incomplete tool calls before sub-agent compaction', () => {
    const messages: UIMessage[] = [
      {
        id: 'msg_assistant',
        role: 'assistant',
        parts: [
          {
            type: 'tool-agent',
            toolCallId: 'call_stuck',
            state: 'input-available',
            input: { instruction: 'research' },
          },
        ],
      },
    ]

    expect(prepareChatMessagesForModel(messages)).toEqual([])
  })
})
