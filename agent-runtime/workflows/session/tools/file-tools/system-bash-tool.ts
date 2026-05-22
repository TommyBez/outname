import {
  getSystemSandbox,
  SYSTEM_SANDBOX_ROOT,
} from '@/agent-runtime/server/agent-sandbox'
import {
  assertWritableSandboxPath,
  type NormalizedSandboxPath,
  normalizeSandboxPath,
} from '../sandbox-file-helpers/paths'
import { readLiveFile } from '../sandbox-file-helpers/read'

interface BashToolSandboxAdapter {
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

class SystemSandboxFileNotFoundError extends Error {
  readonly relPath: string

  constructor(relPath: string) {
    super(`readFile: file not found: ${relPath}`)
    this.name = 'SystemSandboxFileNotFoundError'
    this.relPath = relPath
  }
}

export function isSystemSandboxFileNotFoundError(
  error: unknown
): error is SystemSandboxFileNotFoundError {
  return (
    error instanceof Error && error.name === 'SystemSandboxFileNotFoundError'
  )
}

export async function createSystemBashTool(input: { agentId: string }) {
  const sandbox = await getSystemSandbox(input.agentId)
  const { createBashTool } = (await import(
    bashToolModuleName()
  )) as unknown as {
    createBashTool(args: {
      destination: string
      maxFiles: number
      promptOptions: { toolPrompt: string }
      sandbox: BashToolSandboxAdapter
    }): Promise<{
      tools: {
        readFile: { execute(input: { path: string }): Promise<unknown> }
        writeFile: {
          execute(input: { content: string; path: string }): Promise<unknown>
        }
      }
    }>
  }
  return await createBashTool({
    destination: SYSTEM_SANDBOX_ROOT,
    maxFiles: 0,
    promptOptions: {
      toolPrompt:
        'Bash execution is disabled for this agent. Use readFile, writeFile, listFiles, and grepFiles for sandbox file work.',
    },
    sandbox: createSystemSandboxAdapter({ sandbox }),
  })
}

function bashToolModuleName(): string {
  return 'bash-tool'
}

function createSystemSandboxAdapter(input: {
  sandbox: Awaited<ReturnType<typeof getSystemSandbox>>
}): BashToolSandboxAdapter {
  return {
    executeCommand() {
      return Promise.resolve({
        exitCode: 126,
        stderr:
          'bash is disabled for this agent. Use readFile, writeFile, listFiles, or grepFiles.',
        stdout: '',
      })
    },
    async readFile(path) {
      const content = await readLiveFile(input.sandbox, path)
      if (content === null) {
        const safe = normalizeSandboxPath(path)
        throw new SystemSandboxFileNotFoundError(safe.relPath)
      }
      return content
    },
    async writeFiles(files) {
      const prepared = files.map((file) => {
        const safe = normalizeSandboxPath(file.path)
        assertWritableSandboxPath(safe)
        return {
          content: contentToString(file.content),
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
  sandbox: Awaited<ReturnType<typeof getSystemSandbox>>,
  files: NormalizedSandboxPath[]
): Promise<void> {
  const dirs = new Set(
    files
      .map((file) => pathDirname(file.absPath))
      .filter((dir) => dir !== SYSTEM_SANDBOX_ROOT)
  )

  for (const dir of dirs) {
    let result: Awaited<ReturnType<typeof sandbox.runCommand>>
    try {
      result = await sandbox.runCommand({
        args: ['-p', dir],
        cmd: 'mkdir',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`writeFile: ${message}`)
    }
    if (result.exitCode !== 0) {
      const stderr = await result.stderr()
      throw new Error(
        stderr.trim() || `writeFile: failed to create directory ${dir}`
      )
    }
  }
}

function contentToString(content: string | Buffer): string {
  return typeof content === 'string' ? content : content.toString('utf8')
}

function pathDirname(absPath: string): string {
  return absPath.slice(0, absPath.lastIndexOf('/')) || SYSTEM_SANDBOX_ROOT
}
