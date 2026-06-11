import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreateRepoWorkspaceBashTool,
  mockCurrentToolRuntimeRunId,
  mockRepoWorkspaceSandboxTags,
  mockSandboxGet,
  mockSandboxGetOrCreate,
  mockWithVercelSandboxCredentials,
} = vi.hoisted(() => ({
  mockCreateRepoWorkspaceBashTool: vi.fn(),
  mockCurrentToolRuntimeRunId: vi.fn(),
  mockRepoWorkspaceSandboxTags: vi.fn(() => ({
    attachmentToolId: 'github_repo',
    runId: 'run_test',
  })),
  mockSandboxGet: vi.fn(),
  mockSandboxGetOrCreate: vi.fn(),
  mockWithVercelSandboxCredentials: vi.fn((options) => ({
    ...options,
    projectId: 'prj_test',
    teamId: 'team_test',
    token: 'token_test',
  })),
}))

vi.mock('server-only', () => ({}))

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    get: mockSandboxGet,
    getOrCreate: mockSandboxGetOrCreate,
  },
}))

vi.mock('@outname/ai/tools/runtime/run-id', () => ({
  currentToolRuntimeRunId: mockCurrentToolRuntimeRunId,
}))

vi.mock('@outname/shared/server/vercel-sandbox-config', () => ({
  repoWorkspaceSandboxTags: mockRepoWorkspaceSandboxTags,
  withVercelSandboxCredentials: mockWithVercelSandboxCredentials,
}))

vi.mock('./bash-tool', () => ({
  createRepoWorkspaceBashTool: mockCreateRepoWorkspaceBashTool,
}))

import {
  getOrCreateRepoWorkspace,
  REPO_WORKSPACE_SANDBOX_TIMEOUT_MS,
  stopAllRepoWorkspacesForRun,
} from './sandbox'

const commandSucceeded = {
  exitCode: 0,
  stderr: '',
  stdout: '',
}
const RUN_COUNTER_SANDBOX_NAME_PATTERN = /^repo-run-[0-9]+-[a-f0-9]{16}$/
const SANITIZED_RUN_ID_SANDBOX_NAME_PATTERN =
  /^repo-run-abc-with-spaces-[a-f0-9]{16}$/
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

function createSandbox() {
  return {
    delete: vi.fn(async () => undefined),
    mkDir: vi.fn(async () => undefined),
    runCommand: vi.fn(async () => ({
      exitCode: 0,
      stderr: async () => '',
      stdout: async () => '',
    })),
    stop: vi.fn(async () => undefined),
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
    mockRepoWorkspaceSandboxTags.mockClear()
    mockSandboxGet.mockReset()
    mockSandboxGetOrCreate.mockReset()
    mockWithVercelSandboxCredentials.mockClear()
    runCounter += 1
    mockCurrentToolRuntimeRunId.mockReturnValue(`run_${runCounter}`)
    mockSandboxGetOrCreate.mockResolvedValue(createSandbox())
    mockCreateRepoWorkspaceBashTool.mockResolvedValue(createToolkit())
  })

  it('creates named git source sandboxes and exposes only a serializable handle', async () => {
    const bashExecute = vi.fn(async () => commandSucceeded)
    const sandbox = createSandbox()
    mockSandboxGetOrCreate.mockResolvedValue(sandbox)
    mockCreateRepoWorkspaceBashTool.mockResolvedValue(
      createToolkit(bashExecute)
    )

    const workspace = await createWorkspace()

    expect(workspace.handle).toEqual({
      attachmentToolId: 'github_repo',
      repoUrl: 'https://github.com/acme/repo.git',
      rootPath: '/vercel/sandbox',
      runId: `run_${runCounter}`,
      sandboxName: expect.stringMatching(RUN_COUNTER_SANDBOX_NAME_PATTERN),
      workspaceKey: 'github_repo::https://github.com/acme/repo.git',
    })
    expect('sandbox' in workspace).toBe(false)
    expect('rootPath' in workspace).toBe(false)
    expect(workspace.handle.sandboxName).not.toContain('github.com')
    expect(workspace.handle.sandboxName).not.toContain('ghp_secret-token')
    expect(mockSandboxGetOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: workspace.handle.sandboxName,
        persistent: false,
        ports: [3000],
        projectId: 'prj_test',
        resources: { vcpus: 1 },
        runtime: 'node22',
        source: expect.objectContaining({
          password: 'ghp_secret-token',
          type: 'git',
          url: 'https://github.com/acme/repo.git',
          username: 'x-access-token',
        }),
        teamId: 'team_test',
        timeout: REPO_WORKSPACE_SANDBOX_TIMEOUT_MS,
        token: 'token_test',
      })
    )
    expect(mockCreateRepoWorkspaceBashTool).toHaveBeenCalledWith({
      handle: workspace.handle,
    })
    expect(sandbox.mkDir).toHaveBeenCalledWith('/vercel/sandbox')
    expect(mockSandboxGet).not.toHaveBeenCalled()
    expect(
      mockWithVercelSandboxCredentials.mock.calls.some(
        ([options]) => 'resume' in options
      )
    ).toBe(false)

    const command = (
      bashExecute.mock.calls as unknown as [{ command: string }][]
    ).at(0)?.[0].command
    expect(command).toBeDefined()
    expect(command).toContain(
      "git config --local --add safe.directory '/vercel/sandbox'"
    )
    expect(command).toContain(
      "git remote set-url origin 'https://github.com/acme/repo.git'"
    )
    expect(command).not.toContain('ghp_secret-token')
  })

  it('surfaces stderr when provisioning cannot create the workspace root', async () => {
    const sandbox = createSandbox()
    sandbox.mkDir.mockRejectedValue(new Error('mkDir failed'))
    sandbox.runCommand.mockResolvedValue({
      exitCode: 1,
      stderr: async () => 'mkdir: permission denied',
      stdout: async () => '',
    })
    mockSandboxGetOrCreate.mockResolvedValue(sandbox)

    await expect(createWorkspace()).rejects.toThrow('mkdir: permission denied')

    expect(sandbox.runCommand).toHaveBeenCalledWith({
      args: ['-p', '/vercel/sandbox'],
      cmd: 'mkdir',
    })
    expect(mockCreateRepoWorkspaceBashTool).not.toHaveBeenCalled()
  })

  it('sanitizes the run id and keeps repo identity hashed in the sandbox name', async () => {
    mockCurrentToolRuntimeRunId.mockReturnValue('Run_ABC/with spaces')

    const workspace = await createWorkspace(
      'https://github.com/acme/private-repo.git'
    )

    expect(workspace.handle.sandboxName).toMatch(
      SANITIZED_RUN_ID_SANDBOX_NAME_PATTERN
    )
    expect(workspace.handle.sandboxName).not.toContain('private-repo')
    expect(workspace.handle.sandboxName).not.toContain('acme')
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

    expect(mockSandboxGetOrCreate).toHaveBeenCalledTimes(2)
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
    expect(mockSandboxGetOrCreate).toHaveBeenCalledTimes(1)
  })

  it('deletes cached workspaces by rehydrating the named sandbox', async () => {
    const cleanupSandbox = createSandbox()
    mockSandboxGet.mockResolvedValue(cleanupSandbox)

    const workspace = await createWorkspace()

    await stopAllRepoWorkspacesForRun()

    expect(mockSandboxGet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: workspace.handle.sandboxName,
        resume: false,
      })
    )
    expect(cleanupSandbox.stop).not.toHaveBeenCalled()
    expect(cleanupSandbox.delete).toHaveBeenCalled()
  })
})
