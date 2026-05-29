import type { ToolExecutionOptions } from 'ai'
import { describe, expect, it, vi } from 'vitest'

const {
  MockSystemSandboxFileNotFoundError,
  mockCreateSystemBashTool,
  mockGetSystemSandbox,
} = vi.hoisted(() => {
  class MockSystemSandboxFileNotFoundError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'SystemSandboxFileNotFoundError'
    }
  }

  return {
    MockSystemSandboxFileNotFoundError,
    mockCreateSystemBashTool: vi.fn(),
    mockGetSystemSandbox: vi.fn(),
  }
})

vi.mock('workflow', () => ({
  FatalError: class FatalError extends Error {
    fatal = true

    constructor(message: string) {
      super(message)
      this.name = 'FatalError'
    }
  },
  RetryableError: class RetryableError extends Error {
    retryAfter: Date

    constructor(message: string) {
      super(message)
      this.name = 'RetryableError'
      this.retryAfter = new Date()
    }
  },
}))

vi.mock('@outname/ai/agent-runtime/server/agent-sandbox', () => ({
  getSystemSandbox: mockGetSystemSandbox,
  isMissingSystemSandboxError: vi.fn(() => false),
}))

vi.mock('./system-bash-tool', () => ({
  createSystemBashTool: mockCreateSystemBashTool,
  isSystemSandboxFileNotFoundError: (error: unknown) =>
    error instanceof MockSystemSandboxFileNotFoundError,
}))

import { readFileViaBashTool } from './file-steps'

describe('readFileViaBashTool', () => {
  it('returns file contents from the underlying bash-tool adapter', async () => {
    const execute = vi.fn().mockResolvedValue({ content: 'hello' })
    mockCreateSystemBashTool.mockResolvedValue({
      tools: { readFile: { execute } },
    })

    await expect(
      readFileViaBashTool({
        agentId: 'agent_123',
        options: {} as ToolExecutionOptions,
        path: 'notes.md',
      })
    ).resolves.toEqual({ content: 'hello' })

    expect(execute).toHaveBeenCalledWith(
      { path: 'notes.md' },
      {} as ToolExecutionOptions
    )
  })

  it('returns a deterministic missing-file result instead of throwing', async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(
        new MockSystemSandboxFileNotFoundError(
          'readFile: file not found: notes.md'
        )
      )
    mockCreateSystemBashTool.mockResolvedValue({
      tools: { readFile: { execute } },
    })

    await expect(
      readFileViaBashTool({
        agentId: 'agent_123',
        options: {} as ToolExecutionOptions,
        path: 'notes.md',
      })
    ).resolves.toEqual({
      content: null,
      error: 'readFile: file not found: notes.md',
      exists: false,
    })
  })

  it('rethrows non-missing-file read failures', async () => {
    const error = new Error('permission denied')
    const execute = vi.fn().mockRejectedValue(error)
    mockCreateSystemBashTool.mockResolvedValue({
      tools: { readFile: { execute } },
    })

    await expect(
      readFileViaBashTool({
        agentId: 'agent_123',
        options: {} as ToolExecutionOptions,
        path: 'notes.md',
      })
    ).rejects.toBe(error)
  })
})
