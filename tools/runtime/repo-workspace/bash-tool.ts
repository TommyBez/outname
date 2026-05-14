import type { Sandbox as VercelSandbox } from '@vercel/sandbox'
import type { BashToolkit, Sandbox as BashToolSandbox } from 'bash-tool'
import { RepoWorkspaceProviderError } from './errors'
import {
  assertReadableRepoWorkspacePath,
  assertWritableRepoWorkspacePath,
  type NormalizedRepoWorkspacePath,
  normalizeRepoWorkspacePath,
  REPO_WORKSPACE_ROOT,
} from './paths'

const MAX_BASH_OUTPUT_CHARS = 64 * 1024

export async function createRepoWorkspaceBashTool(input: {
  rootPath?: string
  sandbox: VercelSandbox
}): Promise<BashToolkit> {
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

  const { createBashTool } = await import('bash-tool')

  return await createBashTool({
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
  })
}

function createRepoWorkspaceSandboxAdapter(input: {
  rootPath: string
  sandbox: VercelSandbox
}): BashToolSandbox {
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
      const content = await input.sandbox
        .readFileToBuffer({ path: safe.absPath })
        .catch(() => null)
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
          content:
            typeof file.content === 'string'
              ? file.content
              : file.content.toString('utf8'),
          safe,
        }
      })

      await ensureParentDirectories(
        input.sandbox,
        prepared.map((file) => file.safe)
      )
      await input.sandbox.writeFiles(
        prepared.map((file) => ({
          content: Buffer.from(file.content, 'utf8'),
          path: file.safe.absPath,
        }))
      )
    },
  }
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
