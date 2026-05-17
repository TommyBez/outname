import { describe, expect, it, vi } from 'vitest'

const {
  mockGetReadable,
  mockGetRun,
  mockGetWritable,
  mockReadUIMessageStream,
} = vi.hoisted(() => ({
  mockGetReadable: vi.fn(),
  mockGetRun: vi.fn(),
  mockGetWritable: vi.fn(),
  mockReadUIMessageStream: vi.fn(),
}))

vi.mock('workflow', () => ({
  getWritable: mockGetWritable,
}))

vi.mock('workflow/api', () => ({
  getRun: mockGetRun,
}))

vi.mock('ai', () => ({
  readUIMessageStream: mockReadUIMessageStream,
}))

import { collectSubAgentMessages } from './invocation-stream'

describe('collectSubAgentMessages', () => {
  it('emits progressive parent updates as child messages arrive', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const releaseLock = vi.fn()

    mockGetRun.mockReturnValue({
      getReadable: mockGetReadable.mockReturnValue('readable-stream'),
    })
    mockGetWritable.mockReturnValue({
      getWriter: () => ({
        releaseLock,
        write,
      }),
    })
    mockReadUIMessageStream.mockReturnValue(
      (async function* () {
        yield {
          id: 'msg_1',
          parts: [],
          role: 'assistant',
        }
        yield {
          id: 'msg_2',
          parts: [],
          role: 'assistant',
        }
      })()
    )

    const result = await collectSubAgentMessages({
      progress: {
        childAgentId: 'child_123',
        childName: 'Haiku-San',
        streamNamespace: 'reply:parent',
        toolCallId: 'tool_call_123',
        toolName: 'agent_haiku_san',
      },
      sessionRunId: 'wrun_123',
      streamToken: 'stream_123',
    })

    expect(mockGetReadable).toHaveBeenCalledWith({
      namespace: 'stream_123',
      startIndex: 0,
    })
    expect(mockGetWritable).toHaveBeenCalledWith({
      namespace: 'reply:parent',
    })
    expect(write).toHaveBeenNthCalledWith(1, {
      output: {
        childAgentId: 'child_123',
        childName: 'Haiku-San',
        kind: 'sub_agent',
        messages: [
          {
            id: 'msg_1',
            parts: [],
            role: 'assistant',
          },
        ],
        status: 'running',
        toolName: 'agent_haiku_san',
      },
      preliminary: true,
      toolCallId: 'tool_call_123',
      type: 'tool-output-available',
    })
    expect(write).toHaveBeenNthCalledWith(2, {
      output: {
        childAgentId: 'child_123',
        childName: 'Haiku-San',
        kind: 'sub_agent',
        messages: [
          {
            id: 'msg_1',
            parts: [],
            role: 'assistant',
          },
          {
            id: 'msg_2',
            parts: [],
            role: 'assistant',
          },
        ],
        status: 'running',
        toolName: 'agent_haiku_san',
      },
      preliminary: true,
      toolCallId: 'tool_call_123',
      type: 'tool-output-available',
    })
    expect(releaseLock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      error: null,
      messages: [
        {
          id: 'msg_1',
          parts: [],
          role: 'assistant',
        },
        {
          id: 'msg_2',
          parts: [],
          role: 'assistant',
        },
      ],
    })
  })
})
