import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSandboxGet, mockWithVercelSandboxCredentials } = vi.hoisted(() => ({
  mockSandboxGet: vi.fn(),
  mockWithVercelSandboxCredentials: vi.fn((options) => ({
    ...options,
    projectId: 'prj_test',
    teamId: 'team_test',
    token: 'token_test',
  })),
}))

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    get: mockSandboxGet,
  },
}))

vi.mock('@outname/shared/server/vercel-sandbox-config', () => ({
  withVercelSandboxCredentials: mockWithVercelSandboxCredentials,
}))

import { createRepoWorkspaceBashTool } from './bash-tool'
import { REPO_WORKSPACE_ROOT } from './paths'
import type { RepoWorkspaceHandle } from './types'

interface CommandResult {
  exitCode: number
  stderr(): Promise<string>
  stdout(): Promise<string>
}

interface FakeSandbox {
  readFileToBuffer(file: { path: string }): Promise<Buffer | null>
  runCommand(command: { args?: string[]; cmd: string }): Promise<CommandResult>
  writeFiles(
    files: Array<{ content: Buffer | string; path: string }>
  ): Promise<void>
}

function createHandle(
  overrides: Partial<RepoWorkspaceHandle> = {}
): RepoWorkspaceHandle {
  const repoUrl = 'https://github.com/acme/repo.git'
  return {
    attachmentToolId: 'github_repo',
    repoUrl,
    rootPath: REPO_WORKSPACE_ROOT,
    runId: 'run_123',
    sandboxName: 'repo-run-123-abc123',
    workspaceKey: `github_repo::${repoUrl}`,
    ...overrides,
  }
}

function createSandbox(overrides: Partial<FakeSandbox> = {}): FakeSandbox {
  return {
    readFileToBuffer: vi.fn(async ({ path }) =>
      Buffer.from(`content:${path}`, 'utf8')
    ),
    runCommand: vi.fn(async () => ({
      exitCode: 0,
      stderr: async () => '',
      stdout: async () => 'command output',
    })),
    writeFiles: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('createRepoWorkspaceBashTool', () => {
  beforeEach(() => {
    mockSandboxGet.mockReset()
    mockWithVercelSandboxCredentials.mockClear()
  })

  it('rehydrates the sandbox by serializable handle for bash and read steps', async () => {
    const handle = createHandle()
    const sandbox = createSandbox()
    mockSandboxGet.mockResolvedValue(sandbox)

    const toolkit = await createRepoWorkspaceBashTool({ handle })

    expect(mockSandboxGet).not.toHaveBeenCalled()

    await expect(toolkit.bash.execute({ command: 'pwd' })).resolves.toEqual({
      exitCode: 0,
      stderr: '',
      stdout: 'command output',
    })
    await expect(
      toolkit.tools.readFile.execute({ path: 'README.md' })
    ).resolves.toEqual({
      content: `content:${REPO_WORKSPACE_ROOT}/README.md`,
    })

    expect(sandbox.runCommand).toHaveBeenCalledWith({
      args: ['-lc', `cd "${REPO_WORKSPACE_ROOT}" && pwd`],
      cmd: 'bash',
    })
    expect(mockSandboxGet).toHaveBeenCalledTimes(2)
    expect(mockSandboxGet).toHaveBeenCalledWith(
      expect.objectContaining({ name: handle.sandboxName })
    )
    expect(mockWithVercelSandboxCredentials).toHaveBeenCalledWith({
      name: handle.sandboxName,
    })
    expect(
      mockWithVercelSandboxCredentials.mock.calls.some(
        ([options]) => 'resume' in options
      )
    ).toBe(false)
  })

  it('creates parent directories relative to the handle workspace root', async () => {
    const rootPath = '/custom/root'
    const handle = createHandle({ rootPath })
    const sandbox = createSandbox({
      readFileToBuffer: vi.fn(async () => null),
      runCommand: vi.fn(async () => ({
        exitCode: 0,
        stderr: async () => '',
        stdout: async () => '',
      })),
    })
    mockSandboxGet.mockResolvedValue(sandbox)

    const toolkit = await createRepoWorkspaceBashTool({
      handle: JSON.parse(JSON.stringify(handle)) as RepoWorkspaceHandle,
    })

    await toolkit.tools.writeFile.execute({
      content: 'hello',
      path: 'src/index.ts',
    })

    expect(sandbox.runCommand).toHaveBeenCalledWith({
      args: ['-p', `${rootPath}/src`],
      cmd: 'mkdir',
    })
    expect(sandbox.writeFiles).toHaveBeenCalledWith([
      {
        content: Buffer.from('hello', 'utf8'),
        path: `${rootPath}/src/index.ts`,
      },
    ])
  })
})
