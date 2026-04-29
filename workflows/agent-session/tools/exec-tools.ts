import type { Sandbox as VercelSandbox } from '@vercel/sandbox'
import { type ToolExecutionOptions, tool } from 'ai'
import type { Sandbox as BashToolSandbox, CommandResult } from 'bash-tool'
import { z } from 'zod'
import { getExecSandbox, resetExecSandbox } from '@/lib/agent-sandbox'
import { EXEC_SANDBOX_WORKSPACE } from '@/lib/agent-sandbox-registry'
import { enqueueAppend, type PendingWrites } from './pending-writes'

/**
 * Exec sandbox tools: bash, file_read, file_write (via bash-tool), plus
 * reset_exec. Not buffered like memory tools — bash feedback must be
 * immediate; exec workspace has no agent_files mirror. Output capped per call.
 */

const MAX_OUTPUT_BYTES = 64 * 1024

export interface ExecToolsContext {
  agentId: string
  pending: PendingWrites
}

type BashToolExecutor<TInput> = (
  input: TInput,
  options: ToolExecutionOptions
) => Promise<unknown>

interface RunBashToolArgs {
  agentId: string
  command: string
  options: ToolExecutionOptions
}

interface ReadExecFileArgs {
  agentId: string
  options: ToolExecutionOptions
  path: string
}

interface WriteExecFileArgs {
  agentId: string
  content: string
  options: ToolExecutionOptions
  path: string
}

function commandExitCode(result: unknown): number | null {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('exitCode' in result)
  ) {
    return null
  }
  return typeof result.exitCode === 'number' ? result.exitCode : null
}

function createBashToolSandboxAdapter(sandbox: VercelSandbox): BashToolSandbox {
  return {
    async executeCommand(command: string): Promise<CommandResult> {
      const result = await sandbox.runCommand('bash', ['-c', command])
      const [stdout, stderr] = await Promise.all([
        result.stdout(),
        result.stderr(),
      ])
      return {
        stdout,
        stderr,
        exitCode: result.exitCode,
      }
    },
    async readFile(path: string): Promise<string> {
      const content = await sandbox.readFileToBuffer({ path })
      if (!content) {
        throw new Error(`File not found: ${path}`)
      }
      return content.toString('utf8')
    },
    async writeFiles(files): Promise<void> {
      await sandbox.writeFiles(
        files.map((file) => ({
          path: file.path,
          content: Buffer.isBuffer(file.content)
            ? file.content
            : Buffer.from(file.content),
        }))
      )
    },
  }
}

export function createExecTools(ctx: ExecToolsContext) {
  const { agentId, pending } = ctx

  return {
    bash: tool({
      description:
        'Run a bash command in your exec sandbox workspace and return stdout, stderr, and exit code. Use this for shell commands, package installs, tests, and workspace inspection.',
      inputSchema: z.object({
        command: z.string().min(1).describe('The bash command to run.'),
      }),
      execute: async ({ command }, options) => {
        const result = await runBashTool({ agentId, command, options })

        const day = new Date().toISOString().slice(0, 10)
        const auditCommand =
          command.length > 240 ? `${command.slice(0, 240)}…` : command
        const line = [
          new Date().toISOString(),
          `exit=${commandExitCode(result) ?? 'null'}`,
          auditCommand.replace(/\r?\n/g, ' '),
        ].join(' ')
        enqueueAppend(pending, `logs/${day}.md`, `${line}\n`)
        return result
      },
    }),

    file_read: tool({
      description:
        'Read a UTF-8 file from your exec sandbox workspace. Paths are relative to the workspace unless absolute.',
      inputSchema: z.object({
        path: z.string().min(1).describe('The file path to read.'),
      }),
      execute: async ({ path }, options) =>
        readExecFile({ agentId, options, path }),
    }),

    file_write: tool({
      description:
        'Write a UTF-8 file in your exec sandbox workspace. Creates parent directories as needed.',
      inputSchema: z.object({
        path: z.string().min(1).describe('The file path to write.'),
        content: z.string().describe('The complete file content.'),
      }),
      execute: async ({ path, content }, options) =>
        writeExecFile({ agentId, content, options, path }),
    }),
    reset_exec: tool({
      description:
        'Destroy the exec sandbox (workspace AND snapshot) and re-provision a clean one. Use as a last resort when the workspace is wedged — broken installs, leftover daemons, half-cloned repos, etc. Memory files in your system sandbox are NOT affected. Returns once the new sandbox is ready.',
      inputSchema: z.object({
        reason: z
          .string()
          .min(1)
          .max(500)
          .describe(
            'One-sentence justification for the reset. Logged for the user; helps you avoid re-resetting on the next turn for the same root cause.'
          ),
      }),
      execute: async ({ reason }) => {
        const result = await resetExecSandboxForTool(agentId)
        const day = new Date().toISOString().slice(0, 10)
        const auditReason =
          reason.length > 240 ? `${reason.slice(0, 240)}…` : reason
        const line = [
          new Date().toISOString(),
          `reset_exec destroyed=${result.destroyed}`,
          auditReason.replace(/\r?\n/g, ' '),
        ].join(' ')
        enqueueAppend(pending, `logs/${day}.md`, `${line}\n`)
        return result
      },
    }),
  }
}

async function createAgentBashTool(agentId: string) {
  const sandbox = await getExecSandbox(agentId)
  const { createBashTool } = await import('bash-tool')
  return await createBashTool({
    sandbox: createBashToolSandboxAdapter(sandbox),
    destination: EXEC_SANDBOX_WORKSPACE,
    maxOutputLength: MAX_OUTPUT_BYTES,
  })
}

async function runBashTool(args: RunBashToolArgs): Promise<unknown> {
  'use step'
  const bashTool = await createAgentBashTool(args.agentId)
  const execute = bashTool.tools.bash.execute as
    | BashToolExecutor<{ command: string }>
    | undefined
  if (!execute) {
    throw new Error('bash tool execute handler is unavailable')
  }
  return await execute({ command: args.command }, args.options)
}

async function readExecFile(args: ReadExecFileArgs): Promise<unknown> {
  'use step'
  const bashTool = await createAgentBashTool(args.agentId)
  const execute = bashTool.tools.readFile.execute as
    | BashToolExecutor<{ path: string }>
    | undefined
  if (!execute) {
    throw new Error('file_read tool execute handler is unavailable')
  }
  return await execute({ path: args.path }, args.options)
}

async function writeExecFile(args: WriteExecFileArgs): Promise<unknown> {
  'use step'
  const bashTool = await createAgentBashTool(args.agentId)
  const execute = bashTool.tools.writeFile.execute as
    | BashToolExecutor<{ content: string; path: string }>
    | undefined
  if (!execute) {
    throw new Error('file_write tool execute handler is unavailable')
  }
  return await execute({ content: args.content, path: args.path }, args.options)
}

async function resetExecSandboxForTool(agentId: string) {
  'use step'
  return await resetExecSandbox({ agentId })
}
