import type { Sandbox as VercelSandbox } from '@vercel/sandbox'
import { RepoWorkspaceProviderError } from './errors'
import {
  assertReadableRepoWorkspacePath,
  assertWritableRepoWorkspacePath,
  type NormalizedRepoWorkspacePath,
  normalizeRepoWorkspacePath,
  REPO_WORKSPACE_ROOT,
} from './paths'
import type { RepoWorkspaceBashToolkit } from './types'

const MAX_BASH_OUTPUT_CHARS = 64 * 1024

interface RepoWorkspaceBashToolSandbox {
  executeCommand(command: string): Promise<{
    exitCode: number
    stderr: string
    stdout: string
  }>
  readFile(path: string): Promise<string>
  writeFiles(
    files: Array<{
      content: string | Buffer
      path: string
    }>
  ): Promise<void>
}

export async function createRepoWorkspaceBashTool(input: {
  rootPath?: string
  sandbox: VercelSandbox
}): Promise<RepoWorkspaceBashToolkit> {
  const rootPath = input.rootPath ?? REPO_WORKSPACE_ROOT
  await input.sandbox.mkDir(rootPath).catch(async () => {
    const result = await input.sandbox.runCommand({
      cmd: 'mkdir',
      args: ['-p', rootPath],
    })
    if (result.exitCode !== 0) {
      const stderr = await result.stderr()
      throw new RepoWorkspaceProviderError(
        stderr.trim() || `Failed to create repo workspace root: ${rootPath}`
      )
    }
  })

  const { createBashTool } = (await import(
    bashToolModuleName()
  )) as unknown as {
    createBashTool(args: {
      destination: string
      maxFiles: number
      maxOutputLength: number
      promptOptions: { toolPrompt: string }
      sandbox: RepoWorkspaceBashToolSandbox
    }): Promise<RepoWorkspaceBashToolkit>
  }

  return (await createBashTool({
    destination: rootPath,
    maxFiles: 0,
    maxOutputLength: MAX_BASH_OUTPUT_CHARS,
    promptOptions: {
      toolPrompt:
        'This bash toolkit is used internally by repo workspace maintainer tools.',
    },
    sandbox: createRepoWorkspaceSandboxAdapter({
      rootPath,
      sandbox: input.sandbox,
    }),
  })) as unknown as RepoWorkspaceBashToolkit
}

function bashToolModuleName(): string {
  return 'bash-tool'
}

function createRepoWorkspaceSandboxAdapter(input: {
  rootPath: string
  sandbox: VercelSandbox
}): RepoWorkspaceBashToolSandbox {
  return {
    async executeCommand(command) {
      const result = await input.sandbox.runCommand({
        cmd: 'bash',
        args: ['-lc', command],
      })
      const [stdout, stderr] = await Promise.all([
        result.stdout(),
        result.stderr(),
      ])
      return {
        exitCode: result.exitCode,
        stdout,
        stderr,
      }
    },
    async readFile(path) {
      const safe = normalizeRepoWorkspacePath(path, input.rootPath)
      assertReadableRepoWorkspacePath(safe)
      let content: Buffer | null
      try {
        content = await input.sandbox.readFileToBuffer({ path: safe.absPath })
      } catch (error) {
        if (isMissingFileError(error)) {
          throw new RepoWorkspaceProviderError(
            `readFile: file not found: ${safe.relPath}`
          )
        }
        throw error
      }
      if (content === null) {
        throw new RepoWorkspaceProviderError(
          `readFile: file not found: ${safe.relPath}`
        )
      }
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(content)
      } catch {
        throw new RepoWorkspaceProviderError(
          `readFile: ${safe.relPath} is not valid UTF-8 text.`
        )
      }
    },
    async writeFiles(files) {
      const prepared = files.map((file) => {
        const safe = normalizeRepoWorkspacePath(file.path, input.rootPath)
        assertWritableRepoWorkspacePath(safe)
        return {
          content: normalizeWritableContent(file.content),
          safe,
        }
      })

      await ensureParentDirectories(
        input.sandbox,
        prepared.map((file) => file.safe)
      )
      await input.sandbox.writeFiles(
        prepared.map((file) => ({
          content:
            typeof file.content === 'string'
              ? Buffer.from(file.content, 'utf8')
              : file.content,
          path: file.safe.absPath,
        }))
      )
    },
  }
}

function isMissingFileError(error: unknown): boolean {
  if (!(typeof error === 'object' && error !== null)) {
    return false
  }

  if ('code' in error && error.code === 'ENOENT') {
    return true
  }

  return (
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response &&
    error.response.status === 404
  )
}

function normalizeWritableContent(content: string | Buffer): string | Buffer {
  if (typeof content === 'string') {
    return content
  }
  if (Buffer.isBuffer(content)) {
    return content
  }
  throw new RepoWorkspaceProviderError(
    'writeFile: content must be a UTF-8 string or Buffer.'
  )
}

async function ensureParentDirectories(
  sandbox: VercelSandbox,
  files: NormalizedRepoWorkspacePath[]
): Promise<void> {
  const dirs = new Set(
    files
      .map((file) => pathDirname(file.absPath))
      .filter((dir) => dir !== REPO_WORKSPACE_ROOT)
  )

  for (const dir of dirs) {
    const result = await sandbox.runCommand({
      cmd: 'mkdir',
      args: ['-p', dir],
    })
    if (result.exitCode !== 0) {
      const stderr = await result.stderr()
      throw new RepoWorkspaceProviderError(
        stderr.trim() || `writeFile: failed to create directory ${dir}`
      )
    }
  }
}

function pathDirname(absPath: string): string {
  return absPath.slice(0, absPath.lastIndexOf('/')) || REPO_WORKSPACE_ROOT
}
