import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetOrCreateRepoWorkspace, mockReadBrokeredCredential } = vi.hoisted(
  () => ({
    mockGetOrCreateRepoWorkspace: vi.fn(),
    mockReadBrokeredCredential: vi.fn(),
  })
)

vi.mock('server-only', () => ({}))

vi.mock('@/connections/runtime/credential', () => ({
  readBrokeredCredential: mockReadBrokeredCredential,
}))

vi.mock('@/tools/runtime/define-maintainer-tool/audit', () => ({
  recordToolInvocation: vi.fn(),
}))

vi.mock('@/tools/runtime/repo-workspace/sandbox', () => ({
  getOrCreateRepoWorkspace: mockGetOrCreateRepoWorkspace,
}))

import { githubRepoTool } from './github-repo'

interface BuiltTool {
  execute(input: unknown): Promise<{
    code?: string
    data?: unknown
    message?: string
    ok: boolean
  }>
}

const buildGithubRepoTool = (config: Record<string, unknown>) =>
  githubRepoTool.build({
    agentId: 'agent_test',
    config,
    conversationId: null,
    runId: 'run_test',
    toolId: 'github_repo',
    userId: 'user_test',
  }) as unknown as Record<string, BuiltTool>

describe('githubRepoTool', () => {
  beforeEach(() => {
    mockGetOrCreateRepoWorkspace.mockReset()
    mockReadBrokeredCredential.mockReset()
  })

  it('hides writeFile from the exposed child tools in read-only mode', () => {
    expect(
      githubRepoTool
        .resolveExposedTools({
          repoUrl: 'https://github.com/acme/repo.git',
        })
        .map((tool) => tool.toolId)
    ).toEqual(['github_repo_bash', 'github_repo_read_file'])
  })

  it('does not build writeFile in read-only mode', () => {
    const built = buildGithubRepoTool({
      repoUrl: 'https://github.com/acme/repo.git',
    })

    expect(Object.keys(built)).toEqual([
      'github_repo_bash',
      'github_repo_read_file',
    ])
  })

  it('builds writeFile when read-only mode is disabled', () => {
    const built = buildGithubRepoTool({
      repoUrl: 'https://github.com/acme/repo.git',
      readOnly: false,
    })

    expect(Object.keys(built)).toEqual([
      'github_repo_bash',
      'github_repo_read_file',
      'github_repo_write_file',
    ])
  })

  it('blocks high-risk bash commands before creating the workspace', async () => {
    const built = buildGithubRepoTool({
      repoUrl: 'https://github.com/acme/repo.git',
      readOnly: false,
    })

    await expect(
      built.github_repo_bash.execute({
        command: 'git push --force origin main',
      })
    ).resolves.toMatchObject({
      code: 'policy_denied',
      ok: false,
    })
    expect(mockGetOrCreateRepoWorkspace).not.toHaveBeenCalled()
  })

  it('allows git push --force-with-lease', async () => {
    const bashExecute = vi.fn(async () => ({
      exitCode: 0,
      stderr: '',
      stdout: '',
    }))
    mockReadBrokeredCredential.mockResolvedValue({ token: 'ghp_test-token' })
    mockGetOrCreateRepoWorkspace.mockResolvedValue({
      bashTool: {
        bash: { execute: bashExecute },
        tools: {
          readFile: { execute: vi.fn() },
          writeFile: { execute: vi.fn() },
        },
      },
    })
    const built = buildGithubRepoTool({
      repoUrl: 'https://github.com/acme/repo.git',
      readOnly: false,
    })

    await expect(
      built.github_repo_bash.execute({
        command: 'git push --force-with-lease origin main',
      })
    ).resolves.toEqual({
      ok: true,
      data: {
        exitCode: 0,
        stderr: '',
        stdout: '',
      },
    })
    expect(bashExecute).toHaveBeenCalledWith({
      command: 'git push --force-with-lease origin main',
    })
  })

  it('allows local cleanup commands in the ephemeral workspace', async () => {
    const bashExecute = vi.fn(async () => ({
      exitCode: 0,
      stderr: '',
      stdout: '',
    }))
    mockReadBrokeredCredential.mockResolvedValue({ token: 'ghp_test-token' })
    mockGetOrCreateRepoWorkspace.mockResolvedValue({
      bashTool: {
        bash: { execute: bashExecute },
        tools: {
          readFile: { execute: vi.fn() },
          writeFile: { execute: vi.fn() },
        },
      },
    })
    const built = buildGithubRepoTool({
      repoUrl: 'https://github.com/acme/repo.git',
      readOnly: false,
    })

    await expect(
      built.github_repo_bash.execute({
        command: 'rm -rf .next',
      })
    ).resolves.toEqual({
      ok: true,
      data: {
        exitCode: 0,
        stderr: '',
        stdout: '',
      },
    })
    expect(bashExecute).toHaveBeenCalledWith({
      command: 'rm -rf .next',
    })
  })

  it('returns non-zero bash exits as successful observable results', async () => {
    mockReadBrokeredCredential.mockResolvedValue({ token: 'ghp_test-token' })
    mockGetOrCreateRepoWorkspace.mockResolvedValue({
      bashTool: {
        bash: {
          execute: vi.fn(async () => ({
            exitCode: 1,
            stderr: 'boom',
            stdout: '',
          })),
        },
        tools: {
          readFile: { execute: vi.fn() },
          writeFile: { execute: vi.fn() },
        },
      },
    })
    const built = buildGithubRepoTool({
      repoUrl: 'https://github.com/acme/repo.git',
      readOnly: false,
    })

    await expect(
      built.github_repo_bash.execute({ command: 'false' })
    ).resolves.toEqual({
      ok: true,
      data: {
        exitCode: 1,
        stderr: 'boom',
        stdout: '',
      },
    })
  })
})
