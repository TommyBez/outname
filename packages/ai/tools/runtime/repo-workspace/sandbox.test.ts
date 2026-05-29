import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreateRepoWorkspaceBashTool,
  mockCurrentToolRuntimeRunId,
  mockSandboxCreate,
} = vi.hoisted(() => ({
  mockCreateRepoWorkspaceBashTool: vi.fn(),
  mockCurrentToolRuntimeRunId: vi.fn(),
  mockSandboxCreate: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: mockSandboxCreate,
  },
}))

vi.mock('@outname/ai/tools/runtime/run-id', () => ({
  currentToolRuntimeRunId: mockCurrentToolRuntimeRunId,
}))

vi.mock('./bash-tool', () => ({
  createRepoWorkspaceBashTool: mockCreateRepoWorkspaceBashTool,
}))

import {
  getOrCreateRepoWorkspace,
  REPO_WORKSPACE_SANDBOX_TIMEOUT_MS,
} from './sandbox'

const commandSucceeded = {
  exitCode: 0,
  stderr: '',
  stdout: '',
}
let runCounter = 0

function createToolkit(
  bashExecute = vi.fn(async () => commandSucceeded)
): Awaited<ReturnType<typeof getOrCreateRepoWorkspace>>['bashTool'] {
  return {
    bash: { execute: bashExecute },
    tools: {
      bash: { execute: bashExecute },
      readFile: { execute: vi.fn() },
      writeFile: { execute: vi.fn() },
    },
  }
}

async function createWorkspace(repoUrl = 'https://github.com/acme/repo.git') {
  return await getOrCreateRepoWorkspace({
    attachmentToolId: 'github_repo',
    gitCredentials: {
      password: 'ghp_secret-token',
      username: 'x-access-token',
    },
    networkPolicy: 'deny-all',
    repoUrl,
  })
}

describe('repo workspace sandbox', () => {
  beforeEach(() => {
    mockCreateRepoWorkspaceBashTool.mockReset()
    mockCurrentToolRuntimeRunId.mockReset()
    mockSandboxCreate.mockReset()
    runCounter += 1
    mockCurrentToolRuntimeRunId.mockReturnValue(`run_${runCounter}`)
    mockSandboxCreate.mockResolvedValue({ stop: vi.fn() })
    mockCreateRepoWorkspaceBashTool.mockResolvedValue(createToolkit())
  })

  it('creates git source sandboxes with a one-hour timeout and sanitizes the remote', async () => {
    const bashExecute = vi.fn(async () => commandSucceeded)
    mockCreateRepoWorkspaceBashTool.mockResolvedValue(
      createToolkit(bashExecute)
    )

    const workspace = await createWorkspace()

    expect(workspace.rootPath).toBe('/vercel/sandbox')
    expect(mockSandboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({
          password: 'ghp_secret-token',
          type: 'git',
          url: 'https://github.com/acme/repo.git',
          username: 'x-access-token',
        }),
        timeout: REPO_WORKSPACE_SANDBOX_TIMEOUT_MS,
      })
    )

    const command = (
      bashExecute.mock.calls as unknown as [{ command: string }][]
    ).at(0)?.[0].command
    expect(command).toBeDefined()
    expect(command).toContain(
      "git remote set-url origin 'https://github.com/acme/repo.git'"
    )
    expect(command).not.toContain('ghp_secret-token')
  })

  it('evicts cached workspaces when the sandbox is stopped or expired', async () => {
    const stoppedError = Object.assign(new Error('sandbox stopped'), {
      response: { status: 410 },
    })
    const firstBashExecute = vi
      .fn()
      .mockResolvedValueOnce(commandSucceeded)
      .mockRejectedValueOnce(stoppedError)
    const secondBashExecute = vi.fn(async () => commandSucceeded)
    mockCreateRepoWorkspaceBashTool
      .mockResolvedValueOnce(createToolkit(firstBashExecute))
      .mockResolvedValueOnce(createToolkit(secondBashExecute))

    const firstWorkspace = await createWorkspace()

    await expect(
      firstWorkspace.bashTool.bash.execute({ command: 'pwd' })
    ).rejects.toThrow('stopped or expired')

    await createWorkspace()

    expect(mockSandboxCreate).toHaveBeenCalledTimes(2)
  })

  it('does not evict cached workspaces for unrelated generic errors', async () => {
    const firstBashExecute = vi
      .fn()
      .mockResolvedValueOnce(commandSucceeded)
      .mockRejectedValueOnce(new Error('cache entry expired'))
    mockCreateRepoWorkspaceBashTool.mockResolvedValueOnce(
      createToolkit(firstBashExecute)
    )

    const firstWorkspace = await createWorkspace()

    await expect(
      firstWorkspace.bashTool.bash.execute({ command: 'read-cache' })
    ).rejects.toThrow('cache entry expired')

    const secondWorkspace = await createWorkspace()

    expect(secondWorkspace).toBe(firstWorkspace)
    expect(mockSandboxCreate).toHaveBeenCalledTimes(1)
  })
})
