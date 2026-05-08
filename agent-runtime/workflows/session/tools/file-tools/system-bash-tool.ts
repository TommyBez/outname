import type { Sandbox as BashToolSandbox } from 'bash-tool'
import {
  getSystemSandbox,
  SYSTEM_SANDBOX_ROOT,
} from '@/agent-runtime/server/agent-sandbox'
import {
  assertWritableSandboxPath,
  isTrackedArchitecturePath,
  type NormalizedSandboxPath,
  normalizeSandboxPath,
} from '../sandbox-file-helpers/paths'
import { readLiveFile } from '../sandbox-file-helpers/read'
import type { ReviewBefore } from './types'

export async function createSystemBashTool(input: {
  agentId: string
  reviewBefore?: ReviewBefore[]
}) {
  const sandbox = await getSystemSandbox(input.agentId)
  const { createBashTool } = await import('bash-tool')
  return await createBashTool({
    destination: SYSTEM_SANDBOX_ROOT,
    maxFiles: 0,
    promptOptions: {
      toolPrompt:
        'Bash execution is disabled for this agent. Use readFile, writeFile, listFiles, and grepFiles for sandbox file work.',
    },
    sandbox: createSystemSandboxAdapter({
      reviewBefore: input.reviewBefore,
      sandbox,
    }),
  })
}

function createSystemSandboxAdapter(input: {
  reviewBefore?: ReviewBefore[]
  sandbox: Awaited<ReturnType<typeof getSystemSandbox>>
}): BashToolSandbox {
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
        throw new Error(`readFile: file not found: ${safe.relPath}`)
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
      const trackedBefore = await readTrackedBefore(input.sandbox, prepared)
      input.reviewBefore?.push(...trackedBefore)
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

async function readTrackedBefore(
  sandbox: Awaited<ReturnType<typeof getSystemSandbox>>,
  files: Array<{ content: string; safe: NormalizedSandboxPath }>
): Promise<ReviewBefore[]> {
  const seen = new Set<string>()
  const tracked = files
    .map((file) => file.safe)
    .filter((safe) => isTrackedArchitecturePath(safe.relPath))
    .filter((safe) => {
      if (seen.has(safe.relPath)) {
        return false
      }
      seen.add(safe.relPath)
      return true
    })

  return await Promise.all(
    tracked.map(async (safe) => ({
      before: await readSandboxText(sandbox, safe),
      path: safe.relPath,
    }))
  )
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
    const result = await sandbox.runCommand({
      args: ['-p', dir],
      cmd: 'mkdir',
    })
    if (result.exitCode !== 0) {
      const stderr = await result.stderr()
      throw new Error(
        stderr.trim() || `writeFile: failed to create directory ${dir}`
      )
    }
  }
}

async function readSandboxText(
  sandbox: Awaited<ReturnType<typeof getSystemSandbox>>,
  safe: NormalizedSandboxPath
): Promise<string | null> {
  const buf = await sandbox
    .readFileToBuffer({ path: safe.absPath })
    .catch(() => null)
  return buf ? buf.toString('utf8') : null
}

function contentToString(content: string | Buffer): string {
  return typeof content === 'string' ? content : content.toString('utf8')
}

function pathDirname(absPath: string): string {
  return absPath.slice(0, absPath.lastIndexOf('/')) || SYSTEM_SANDBOX_ROOT
}
