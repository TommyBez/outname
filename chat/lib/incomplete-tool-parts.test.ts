import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'
import {
  isIncompleteToolPart,
  stripIncompleteToolPartsForModel,
} from './incomplete-tool-parts'

describe('incomplete tool parts', () => {
  it('detects streaming and pending tool states', () => {
    expect(
      isIncompleteToolPart({
        type: 'tool-search',
        toolCallId: 'call_streaming',
        state: 'input-streaming',
        input: { q: 'test' },
      })
    ).toBe(true)
    expect(
      isIncompleteToolPart({
        type: 'tool-search',
        toolCallId: 'call_1',
        state: 'input-available',
        input: { q: 'test' },
      })
    ).toBe(true)
    expect(
      isIncompleteToolPart({
        type: 'tool-search',
        toolCallId: 'call_approval',
        state: 'approval-requested',
        input: { q: 'test' },
        approval: { id: 'approval_1' },
      })
    ).toBe(true)
    expect(
      isIncompleteToolPart({
        type: 'text',
        text: 'hello',
      })
    ).toBe(false)
  })

  it('removes incomplete tool parts but keeps completed ones', () => {
    const messages: UIMessage[] = [
      {
        id: 'msg_assistant',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Working on it.' },
          {
            type: 'tool-search',
            toolCallId: 'call_pending',
            state: 'input-available',
            input: { q: 'inbox' },
          },
          {
            type: 'tool-search',
            toolCallId: 'call_done',
            state: 'output-available',
            input: { q: 'sent' },
            output: { ok: true },
          },
        ],
      },
    ]

    const repaired = stripIncompleteToolPartsForModel(messages)

    expect(repaired).toHaveLength(1)
    expect(repaired[0]?.parts).toHaveLength(2)
    expect(repaired[0]?.parts[1]).toMatchObject({
      toolCallId: 'call_done',
      state: 'output-available',
    })
  })

  it('drops assistant messages that only contained incomplete tools', () => {
    const messages: UIMessage[] = [
      {
        id: 'msg_user',
        role: 'user',
        parts: [{ type: 'text', text: 'Go' }],
      },
      {
        id: 'msg_assistant',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'search',
            toolCallId: 'call_00_ET_kvN0aKc9jwygtgv9RnDI8146',
            state: 'input-available',
            input: {},
          },
        ],
      },
    ]

    const repaired = stripIncompleteToolPartsForModel(messages)

    expect(repaired).toEqual([messages[0]])
  })
})
