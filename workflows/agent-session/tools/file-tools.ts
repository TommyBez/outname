import { type Tool, type ToolExecutionOptions, tool } from 'ai'
import type { Sandbox as BashToolSandbox } from 'bash-tool'
import { z } from 'zod'
import { getSystemSandbox, SYSTEM_SANDBOX_ROOT } from '@/lib/agent-sandbox'
import { type PendingWrites, rememberReviewBefore } from './pending-writes'
import {
  assertWritableSandboxPath,
  grepLiveFiles,
  isTrackedArchitecturePath,
  listLiveFiles,
  type NormalizedSandboxPath,
  normalizeSandboxPath,
  readLiveFile,
} from './sandbox-file-helpers'

const MAX_LIST_RESULTS = 1000
const MAX_GREP_RESULTS = 200

export interface FileToolsContext {
  agentId: string
  pending: PendingWrites
}

interface ReviewBefore {
  before: string | null
  path: string
}

type BashToolExecutor<TInput> = (
  input: TInput,
  options: ToolExecutionOptions
) => Promise<unknown>

export function createFileTools(ctx: FileToolsContext): Record<string, Tool> {
  return {
    readFile: tool({
      description: 'Read the contents of a file from the system sandbox.',
      inputSchema: z.object({
        path: z.string().describe('The path to the file to read'),
      }),
      execute: async ({ path }, options) =>
        readFileViaBashTool({ agentId: ctx.agentId, options, path }),
    }),
    writeFile: tool({
      description:
        'Write content to a file in the system sandbox. Creates parent directories if needed.',
      inputSchema: z.object({
        content: z.string().describe('The content to write to the file'),
        path: z.string().describe('The path where the file should be written'),
      }),
      execute: async ({ content, path }, options) => {
        const result = await writeFileViaBashTool({
          agentId: ctx.agentId,
          content,
          options,
          path,
        })
        for (const before of result.reviewBefore) {
          rememberReviewBefore(ctx.pending, before.path, before.before)
        }
        return result.toolResult
      },
    }),
    listFiles: tool({
      description:
        'List files in the persistent system sandbox. Paths are relative to /vercel/sandbox.',
      inputSchema: z.object({
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIST_RESULTS)
          .optional()
          .describe('Maximum number of paths to return. Defaults to 200.'),
        pathPrefix: z
          .string()
          .optional()
          .describe(
            "Optional relative or /vercel/sandbox path prefix, e.g. 'logs/' or 'projects/demo'."
          ),
      }),
      execute: async ({ maxResults, pathPrefix }) =>
        listFilesStep(ctx.agentId, {
          maxResults: maxResults ?? 200,
          pathPrefix: pathPrefix ?? '',
        }),
    }),
    grepFiles: tool({
      description:
        'Search text files in the persistent system sandbox with internal fixed-argv grep. No shell is exposed.',
      inputSchema: z.object({
        caseInsensitive: z
          .boolean()
          .optional()
          .describe('Use case-insensitive matching. Defaults to false.'),
        fixedString: z
          .boolean()
          .optional()
          .describe(
            'Treat pattern as a literal fixed string instead of an extended regular expression. Defaults to false.'
          ),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(MAX_GREP_RESULTS)
          .optional()
          .describe('Maximum number of matches to return. Defaults to 50.'),
        pathPrefix: z
          .string()
          .optional()
          .describe(
            "Optional relative or /vercel/sandbox path prefix to restrict search, e.g. 'logs/'."
          ),
        pattern: z
          .string()
          .min(1)
          .max(500)
          .describe(
            'Pattern to search. Uses grep -E by default; set fixedString=true for literal text.'
          ),
      }),
      execute: async ({
        caseInsensitive,
        fixedString,
        maxResults,
        pathPrefix,
        pattern,
      }) =>
        grepFilesStep(ctx.agentId, {
          caseInsensitive: caseInsensitive ?? false,
          fixedString: fixedString ?? false,
          maxResults: maxResults ?? 50,
          pathPrefix: pathPrefix ?? '',
          pattern,
        }),
    }),
  }
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

async function createSystemBashTool(input: {
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

async function readFileViaBashTool(args: {
  agentId: string
  options: ToolExecutionOptions
  path: string
}): Promise<unknown> {
  'use step'
  const bashTool = await createSystemBashTool({ agentId: args.agentId })
  const execute = bashTool.tools.readFile.execute as
    | BashToolExecutor<{ path: string }>
    | undefined
  if (!execute) {
    throw new Error('readFile tool execute handler is unavailable')
  }
  return await execute({ path: args.path }, args.options)
}

async function writeFileViaBashTool(args: {
  agentId: string
  content: string
  options: ToolExecutionOptions
  path: string
}): Promise<{ reviewBefore: ReviewBefore[]; toolResult: unknown }> {
  'use step'
  const reviewBefore: ReviewBefore[] = []
  const bashTool = await createSystemBashTool({
    agentId: args.agentId,
    reviewBefore,
  })
  const execute = bashTool.tools.writeFile.execute as
    | BashToolExecutor<{ content: string; path: string }>
    | undefined
  if (!execute) {
    throw new Error('writeFile tool execute handler is unavailable')
  }
  const toolResult = await execute(
    { content: args.content, path: args.path },
    args.options
  )
  return { reviewBefore, toolResult }
}

async function listFilesStep(
  agentId: string,
  input: { maxResults: number; pathPrefix: string }
): Promise<{ paths: string[]; truncated: boolean }> {
  'use step'
  const sandbox = await getSystemSandbox(agentId)
  return await listLiveFiles(sandbox, input)
}

async function grepFilesStep(
  agentId: string,
  input: {
    caseInsensitive: boolean
    fixedString: boolean
    maxResults: number
    pathPrefix: string
    pattern: string
  }
): Promise<{
  matches: Array<{ line: number; path: string; text: string }>
  truncated: boolean
}> {
  'use step'
  const sandbox = await getSystemSandbox(agentId)
  return await grepLiveFiles(sandbox, input)
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
