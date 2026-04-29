import { tool } from "ai"
import { z } from "zod"
import { createBashTool } from "bash-tool"
import { getExecSandbox, resetExecSandbox } from "@/lib/agent-sandbox"
import { EXEC_SANDBOX_WORKSPACE } from "@/lib/agent-sandbox-registry"
import { enqueueAppend, type PendingWrites } from "./pending-writes"

/**
 * Exec tools — surface the agent's *exec* sandbox to the LLM.
 *
 * The exec sandbox is a separate, longer-timeout Vercel Sandbox that
 * the agent can shell into for general-purpose work: running scripts,
 * reading/writing arbitrary files, hitting network APIs, etc. Files
 * persist across events through snapshot-on-stop, so a heartbeat run
 * can pick up artifacts a chat turn left behind.
 *
 * Surface: `bash`, `file_read`, `file_write`, `reset_exec`.
 * `bash`, `file_read`, and `file_write` delegate to the upstream
 * `bash-tool` package; `reset_exec` remains local because it manages
 * this app's sandbox lifecycle.
 *
 * Why these tools are *not* buffered like memory tools:
 *   - Bash output is the agent's primary feedback signal; buffering
 *     would hide errors until end-of-event.
 *   - The exec sandbox has no `agent_files` mirror, so there's nothing
 *     to atomicity-protect at the turn boundary.
 *
 * Bash output is capped before being returned to the model.
 */

const MAX_OUTPUT_BYTES = 64 * 1024 // 64 KiB

export interface ExecToolsContext {
  agentId: string
  /**
   * Per-event mutation buffer shared with the memory tools. Bash and
   * reset calls append audit lines here; `endOfEvent` flushes them
   * with the rest of the turn's memory writes.
   */
  pending: PendingWrites
}

function commandExitCode(result: unknown): number | null {
  if (typeof result !== "object" || result === null || !("exitCode" in result)) {
    return null
  }
  return typeof result.exitCode === "number" ? result.exitCode : null
}

export async function createExecTools(ctx: ExecToolsContext) {
  "use step"

  const { agentId, pending } = ctx

  const sandbox = await getExecSandbox(agentId)

  const bashTool = await createBashTool({
    sandbox,
    destination: EXEC_SANDBOX_WORKSPACE,
    maxOutputLength: MAX_OUTPUT_BYTES,
  })

  return {
    bash: tool({
      description: bashTool.tools.bash.description,
      inputSchema: bashTool.tools.bash.inputSchema,
      execute: async ({ command }, options) => {
        "use step"
        const result = await bashTool.tools.bash.execute!({ command }, options)

        const day = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
        const auditCommand =
          command.length > 240 ? `${command.slice(0, 240)}…` : command
        const line = [
          new Date().toISOString(),
          `exit=${commandExitCode(result) ?? "null"}`,
          auditCommand.replace(/\r?\n/g, " "),
        ].join(" ")
        enqueueAppend(pending, `logs/${day}.md`, `${line}\n`)
        return result
      },
    }),

    file_read: tool({
      description: bashTool.tools.readFile.description,
      inputSchema: bashTool.tools.readFile.inputSchema,
      execute: async ({ path }, options) => {
        "use step"
        return bashTool.tools.readFile.execute!({ path }, options)
      },
    }),

    file_write: tool({
      description: bashTool.tools.writeFile.description,
      inputSchema: bashTool.tools.writeFile.inputSchema,
      execute: async ({ path, content }, options) => {
        "use step"
        return bashTool.tools.writeFile.execute!({ path, content }, options)
      },
    }),
    reset_exec: tool({
      description:
        "Destroy the exec sandbox (workspace AND snapshot) and re-provision a clean one. Use as a last resort when the workspace is wedged — broken installs, leftover daemons, half-cloned repos, etc. Memory files in your system sandbox are NOT affected. Returns once the new sandbox is ready.",
      inputSchema: z.object({
        reason: z
          .string()
          .min(1)
          .max(500)
          .describe(
            "One-sentence justification for the reset. Logged for the user; helps you avoid re-resetting on the next turn for the same root cause.",
          ),
      }),
      execute: async ({ reason }) => {
        const result = await resetExecSandbox({ agentId })
        // Audit the reset into the same daily log the bash tool
        // writes to, so the model can grep its own reset history
        // alongside the commands it ran. We tag the line with
        // 'reset_exec' instead of 'exit=N' so a quick grep
        // separates the two surfaces.
        const day = new Date().toISOString().slice(0, 10)
        const auditReason =
          reason.length > 240 ? `${reason.slice(0, 240)}…` : reason
        const line = [
          new Date().toISOString(),
          `reset_exec destroyed=${result.destroyed}`,
          auditReason.replace(/\r?\n/g, " "),
        ].join(" ")
        enqueueAppend(pending, `logs/${day}.md`, `${line}\n`)
        return result
      },
    }),
  }
}
