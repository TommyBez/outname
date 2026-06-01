import { describe, expect, it, vi } from 'vitest'
import { createRepoWorkspaceBashTool } from './bash-tool'
import { REPO_WORKSPACE_ROOT } from './paths'

type SandboxInput = Parameters<typeof createRepoWorkspaceBashTool>[0]['sandbox']

interface CommandResult {
  exitCode: number
  stderr(): Promise<string>
  stdout(): Promise<string>
}

interface FakeSandbox {
  mkDir(path: string): Promise<void>
  readFileToBuffer(file: { path: string }): Promise<Buffer | null>
  runCommand(command: { args?: string[]; cmd: string }): Promise<CommandResult>
  writeFiles(
    files: Array<{ content: Buffer | string; path: string }>
  ): Promise<void>
}

function asSandbox(fake: FakeSandbox): SandboxInput {
  return fake as unknown as SandboxInput
}

describe('createRepoWorkspaceBashTool', () => {
  it('creates a bash toolkit rooted under the Vercel workspace path', async () => {
    const sandbox: FakeSandbox = {
      mkDir: vi.fn(async () => undefined),
      readFileToBuffer: vi.fn(async ({ path }) =>
        Buffer.from(`content:${path}`, 'utf8')
      ),
      runCommand: vi.fn(async () => ({
        exitCode: 0,
        stderr: async () => '',
        stdout: async () => 'command output',
      })),
      writeFiles: vi.fn(async () => undefined),
    }

    const toolkit = await createRepoWorkspaceBashTool({
      sandbox: asSandbox(sandbox),
    })

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

    expect(sandbox.mkDir).toHaveBeenCalledWith(REPO_WORKSPACE_ROOT)
    expect(sandbox.runCommand).toHaveBeenCalledWith({
      args: ['-lc', `cd "${REPO_WORKSPACE_ROOT}" && pwd`],
      cmd: 'bash',
    })
  })

  it('surfaces stderr when the workspace root cannot be created', async () => {
    const sandbox: FakeSandbox = {
      mkDir: vi.fn(() => Promise.reject(new Error('mkDir failed'))),
      readFileToBuffer: vi.fn(async () => null),
      runCommand: vi.fn(async () => ({
        exitCode: 1,
        stderr: async () => 'mkdir: permission denied',
        stdout: async () => '',
      })),
      writeFiles: vi.fn(async () => undefined),
    }

    await expect(
      createRepoWorkspaceBashTool({ sandbox: asSandbox(sandbox) })
    ).rejects.toThrow('mkdir: permission denied')
    expect(sandbox.runCommand).toHaveBeenCalledWith({
      args: ['-p', REPO_WORKSPACE_ROOT],
      cmd: 'mkdir',
    })
  })

  it('creates parent directories relative to a custom workspace root', async () => {
    const rootPath = '/custom/root'
    const sandbox: FakeSandbox = {
      mkDir: vi.fn(async () => undefined),
      readFileToBuffer: vi.fn(async () => null),
      runCommand: vi.fn(async () => ({
        exitCode: 0,
        stderr: async () => '',
        stdout: async () => '',
      })),
      writeFiles: vi.fn(async () => undefined),
    }

    const toolkit = await createRepoWorkspaceBashTool({
      rootPath,
      sandbox: asSandbox(sandbox),
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
