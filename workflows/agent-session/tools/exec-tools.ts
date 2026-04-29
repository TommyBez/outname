import type { Sandbox as VercelSandbox } from '@vercel/sandbox'
import { tool } from 'ai'
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

export async function createExecTools(ctx: ExecToolsContext) {
  'use step'

  const { agentId, pending } = ctx

  const sandbox = await getExecSandbox(agentId)
  const { createBashTool } = await import('bash-tool')
  const bashToolSandbox = createBashToolSandboxAdapter(sandbox)

  const bashTool = await createBashTool({
    sandbox: bashToolSandbox,
    destination: EXEC_SANDBOX_WORKSPACE,
    maxOutputLength: MAX_OUTPUT_BYTES,
  })

  return {
    bash: tool({
      description: bashTool.tools.bash.description,
      inputSchema: bashTool.tools.bash.inputSchema,
      execute: async ({ command }, options) => {
        'use step'
        const result = await bashTool.tools.bash.execute?.({ command }, options)

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
      description: bashTool.tools.readFile.description,
      inputSchema: bashTool.tools.readFile.inputSchema,
      execute: async ({ path }, options) => {
        'use step'
        return await bashTool.tools.readFile.execute?.({ path }, options)
      },
    }),

    file_write: tool({
      description: bashTool.tools.writeFile.description,
      inputSchema: bashTool.tools.writeFile.inputSchema,
      execute: async ({ path, content }, options) => {
        'use step'
        return await bashTool.tools.writeFile.execute?.(
          { path, content },
          options
        )
      },
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
        'use step'
        const result = await resetExecSandbox({ agentId })
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
