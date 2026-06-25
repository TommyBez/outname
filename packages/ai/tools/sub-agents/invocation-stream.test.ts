import { describe, expect, it, vi } from 'vitest'

const {
  mockCreateModelCallToUIChunkTransform,
  mockGetReadable,
  mockGetRun,
  mockGetWritable,
  mockReadUIMessageStream,
} = vi.hoisted(() => ({
  mockCreateModelCallToUIChunkTransform: vi.fn(() => 'model-call-transform'),
  mockGetReadable: vi.fn(),
  mockGetRun: vi.fn(),
  mockGetWritable: vi.fn(),
  mockReadUIMessageStream: vi.fn(),
}))

vi.mock('@outname/workflow/runtime', () => ({
  getWritable: mockGetWritable,
}))

vi.mock('@ai-sdk/workflow', () => ({
  createModelCallToUIChunkTransform: mockCreateModelCallToUIChunkTransform,
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
    const pipeThrough = vi.fn().mockReturnValue('ui-readable-stream')
    const write = vi.fn().mockResolvedValue(undefined)
    const releaseLock = vi.fn()

    mockGetRun.mockReturnValue({
      getReadable: mockGetReadable.mockReturnValue({ pipeThrough }),
    })
    mockGetWritable.mockReturnValue({
      getWriter: () => ({
        releaseLock,
        write,
      }),
    })
    mockReadUIMessageStream.mockReturnValue(
      (async function* () {
        await Promise.resolve()
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
        target: {
          kind: 'workflow-parent-stream',
          streamNamespace: 'reply:parent',
        },
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
    expect(pipeThrough).toHaveBeenCalledWith('model-call-transform')
    expect(mockGetWritable).toHaveBeenCalledWith({
      namespace: 'reply:parent',
    })
    expect(write).toHaveBeenNthCalledWith(1, {
      dynamic: true,
      input: {},
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
      toolName: 'agent_haiku_san',
      type: 'tool-result',
    })
    expect(write).toHaveBeenNthCalledWith(2, {
      dynamic: true,
      input: {},
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
      toolName: 'agent_haiku_san',
      type: 'tool-result',
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

  it('emits progressive parent updates to the realtime UI writer', async () => {
    const pipeThrough = vi.fn().mockReturnValue('ui-readable-stream')
    const write = vi.fn()

    mockGetRun.mockReturnValue({
      getReadable: mockGetReadable.mockReturnValue({ pipeThrough }),
    })
    mockGetWritable.mockImplementation(() => {
      throw new Error('getWritable should not be called')
    })
    mockReadUIMessageStream.mockReturnValue(
      (async function* () {
        await Promise.resolve()
        yield {
          id: 'msg_1',
          parts: [],
          role: 'assistant',
        }
      })()
    )

    const result = await collectSubAgentMessages({
      progress: {
        childAgentId: 'child_123',
        childName: 'Haiku-San',
        target: {
          kind: 'realtime-ui-writer',
          writer: { write } as never,
        },
        toolCallId: 'tool_call_123',
        toolName: 'agent_haiku_san',
      },
      sessionRunId: 'wrun_123',
      streamToken: 'stream_123',
    })

    expect(mockGetWritable).not.toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith({
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
    expect(result).toEqual({
      error: null,
      messages: [
        {
          id: 'msg_1',
          parts: [],
          role: 'assistant',
        },
      ],
    })
  })

  it('does not touch workflow writable streams when progress target is none', async () => {
    const pipeThrough = vi.fn().mockReturnValue('ui-readable-stream')
    mockGetRun.mockReturnValue({
      getReadable: mockGetReadable.mockReturnValue({ pipeThrough }),
    })
    mockGetWritable.mockImplementation(() => {
      throw new Error('getWritable should not be called')
    })
    mockReadUIMessageStream.mockReturnValue(
      (async function* () {
        await Promise.resolve()
        yield {
          id: 'msg_1',
          parts: [],
          role: 'assistant',
        }
      })()
    )

    const result = await collectSubAgentMessages({
      progress: {
        childAgentId: 'child_123',
        childName: 'Haiku-San',
        target: { kind: 'none' },
        toolCallId: 'tool_call_123',
        toolName: 'agent_haiku_san',
      },
      sessionRunId: 'wrun_123',
      streamToken: 'stream_123',
    })

    expect(mockGetWritable).not.toHaveBeenCalled()
    expect(result).toEqual({
      error: null,
      messages: [
        {
          id: 'msg_1',
          parts: [],
          role: 'assistant',
        },
      ],
    })
  })
})
