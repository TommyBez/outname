import { describe, expect, it, vi } from 'vitest'

const { mockGetSystemSandbox } = vi.hoisted(() => ({
  mockGetSystemSandbox: vi.fn(),
}))

vi.mock('@outname/workflow/runtime', async () => {
  const { createWorkflowRuntimeMock } = await import(
    '../../../../../../../test/helpers/workflow-runtime-mock'
  )

  return createWorkflowRuntimeMock()
})

vi.mock('@outname/ai/agent-runtime/server/agent-sandbox', () => ({
  getSystemSandbox: mockGetSystemSandbox,
  isMissingSystemSandboxError: vi.fn(() => false),
}))

import { readFileStep, writeFileStep } from './file-steps'

describe('file steps', () => {
  it('returns file contents from the system sandbox', async () => {
    mockGetSystemSandbox.mockResolvedValue({
      readFileToBuffer: vi.fn().mockResolvedValue(Buffer.from('hello')),
    })

    await expect(
      readFileStep({
        agentId: 'agent_123',
        path: 'notes.md',
      })
    ).resolves.toEqual({ content: 'hello' })
  })

  it('returns a deterministic missing-file result instead of throwing', async () => {
    mockGetSystemSandbox.mockResolvedValue({
      readFileToBuffer: vi.fn().mockResolvedValue(null),
    })

    await expect(
      readFileStep({
        agentId: 'agent_123',
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
    mockGetSystemSandbox.mockResolvedValue({
      readFileToBuffer: vi.fn().mockRejectedValue(error),
    })

    await expect(
      readFileStep({
        agentId: 'agent_123',
        path: 'notes.md',
      })
    ).rejects.toBe(error)
  })

  it('writes file contents and creates parent directories', async () => {
    const writeFiles = vi.fn().mockResolvedValue(undefined)
    const runCommand = vi.fn().mockResolvedValue({
      exitCode: 0,
      stderr: vi.fn().mockResolvedValue(''),
    })
    mockGetSystemSandbox.mockResolvedValue({
      runCommand,
      writeFiles,
    })

    await expect(
      writeFileStep({
        agentId: 'agent_123',
        content: 'hello',
        path: 'logs/2026/06/today.md',
      })
    ).resolves.toEqual({ success: true })

    expect(runCommand).toHaveBeenCalledTimes(1)
    expect(runCommand).toHaveBeenCalledWith({
      args: ['-p', '/vercel/sandbox/logs/2026/06'],
      cmd: 'mkdir',
    })
    expect(writeFiles).toHaveBeenCalledWith([
      {
        content: Buffer.from('hello', 'utf8'),
        path: '/vercel/sandbox/logs/2026/06/today.md',
      },
    ])
  })
})
