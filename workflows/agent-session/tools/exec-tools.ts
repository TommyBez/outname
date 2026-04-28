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
 * Architecture: the bash / file_read / file_write tools delegate to
 * the `bash-tool` package (vercel-labs/bash-tool). Per the architect's
 * Phase 2 follow-up directive, this gives us:
 *
 *   - AI-SDK-native tool wrappers maintained upstream.
 *   - First-class `onAfterBashCall` hook for the audit log instead of
 *     hand-rolled "call enqueueAppend after bashStep returns" code.
 *   - Forward path to `experimental_createSkillTool` for Phase 3.
 *
 * Local tools that bash-tool does not provide:
 *
 *   - `file_list` — directory listing with file/dir tagging. Useful
 *     to the agent for understanding workspace shape without
 *     parsing `ls` output.
 *   - `reset_exec` — destroys + re-provisions the exec sandbox when
 *     the workspace is wedged. Memory volume is untouched.
 *
 * All paths in `file_list` / `reset_exec` are interpreted relative to
 * the persistent workspace directory (`/vercel/sandbox/workspace`).
 *
 * Why these tools are *not* buffered like memory tools:
 *   - Bash output is the agent's primary feedback signal; buffering
 *     would hide errors until end-of-event.
 *   - The exec sandbox has no `agent_files` mirror, so there's nothing
 *     to atomicity-protect at the turn boundary.
 *
 * Per-call sizing limits keep the response payload safe to feed back
 * into the model without blowing the context window.
 */

const MAX_OUTPUT_BYTES = 64 * 1024 // 64 KiB stdout/stderr per call

export interface ExecToolsContext {
  agentId: string
  /**
   * Per-event mutation buffer shared with the memory tools. Bash
   * calls enqueue a one-line append into `logs/<UTC date>.md` here;
   * `endOfEvent` flushes the queue to the system sandbox and mirrors
   * it into `agent_files`. The append is buffered (not write-through)
   * so a long bash sequence inside one turn produces a single
   * round-trip at flush time instead of one per call.
   */
  pending: PendingWrites
}

/**
 * Build the exec tool surface for one agent event. Async because
 * `createBashTool` resumes the exec sandbox and stitches together
 * `bash`, `readFile`, and `writeFile` from the bash-tool package.
 */
export async function createExecTools(ctx: ExecToolsContext) {
  const { agentId, pending } = ctx

  // Resume the persistent exec sandbox. `getExecSandbox` is idempotent
  // and shares the resumed instance across the rest of this event,
  // so the `file_list` / `reset_exec` tools below can re-resume
  // cheaply when they run.
  const execSandbox = await getExecSandbox(agentId)

  // Hand the resumed sandbox to bash-tool. We pass an explicit
  // `toolPrompt: ""` so the toolkit skips its on-boot capability probe
  // (rg / jq / etc. detection) — the probe is one extra
  // `executeCommand` round-trip per agent build, which would add
  // measurable latency to every chat / heartbeat event for a feature
  // we don't yet rely on. We can re-enable it later if AGENTS.md ever
  // wants the autodiscovered prompt.
  const bashKit = await createBashTool({
    sandbox: execSandbox,
    destination: EXEC_SANDBOX_WORKSPACE,
    maxOutputLength: MAX_OUTPUT_BYTES,
    promptOptions: { toolPrompt: "" },
    extraInstructions:
      "Every bash call is automatically appended to logs/<UTC date>.md in your memory volume — you can grep your own command history with search_memory.",
    onAfterBashCall: ({ command, result }) => {
      // Audit log: append a single line per bash call into a daily
      // log file under the memory volume. ISO timestamp + exit code
      // + truncated command. Bash-tool guarantees this hook runs
      // once per call, after stdout/stderr are populated, before the
      // tool returns to the model — perfect spot to stamp an audit
      // line without blocking the result on a sandbox round-trip.
      const day = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      const auditCommand =
        command.length > 240 ? `${command.slice(0, 240)}…` : command
      const line = [
        new Date().toISOString(),
        `exit=${result.exitCode ?? "null"}`,
        auditCommand.replace(/\r?\n/g, " "),
      ].join(" ")
      enqueueAppend(pending, `logs/${day}.md`, `${line}\n`)
      // Returning undefined keeps the result unchanged. We don't need
      // to mutate stdout / stderr here.
      return undefined
    },
  })

  return {
    // bash-tool's three tools, renamed to our existing taxonomy so
    // AGENTS.md and call sites stay stable. The shapes are
    // compatible:
    //   bash      ({ command }) -> { stdout, stderr, exitCode }
    //   readFile  ({ path })    -> { content }
    //   writeFile ({ path, content }) -> { success: boolean }
    bash: bashKit.tools.bash,
    file_read: bashKit.tools.readFile,
    file_write: bashKit.tools.writeFile,

    file_list: tool({
      description:
        "List files under a directory in the exec sandbox workspace. Returns paths relative to the workspace root, tagged 'file' or 'dir'. Faster than parsing `ls` output yourself.",
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .describe(
            "Workspace-relative directory. Defaults to the workspace root.",
          ),
      }),
      execute: async ({ path }) => fileListStep(agentId, path ?? ""),
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

/* -------------------------------------------------------------------------- */
/* Path helpers                                                                */
/* -------------------------------------------------------------------------- */

function resolveWorkspacePath(input: string): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new Error("path must be a non-empty string")
  }
  // Reject NUL chars and obvious traversal early. We allow `..` only
  // if the resolved path stays under the workspace prefix — checked
  // below by string prefix.
  if (input.includes("\0")) {
    throw new Error("path may not contain NUL bytes")
  }
  const abs = input.startsWith("/")
    ? input
    : `${EXEC_SANDBOX_WORKSPACE}/${input}`
  // Lightweight normalization: collapse repeated slashes; reject
  // segments that walk above the workspace root.
  const normalized = normalizePath(abs)
  if (
    normalized !== EXEC_SANDBOX_WORKSPACE &&
    !normalized.startsWith(`${EXEC_SANDBOX_WORKSPACE}/`)
  ) {
    throw new Error(
      `path must stay under ${EXEC_SANDBOX_WORKSPACE} (got ${normalized})`,
    )
  }
  return normalized
}

function normalizePath(p: string): string {
  const out: string[] = []
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue
    if (seg === "..") {
      out.pop()
      continue
    }
    out.push(seg)
  }
  return "/" + out.join("/")
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */
/* Only `file_list` retains a hand-rolled step now — bash / file_read /       */
/* file_write delegate to bash-tool. Path resolution is duplicated here       */
/* because file_list takes an optional path that maps "" to the workspace     */
/* root and bash-tool's path semantics don't quite fit that shape.            */

async function fileListStep(
  agentId: string,
  rawDir: string,
): Promise<{ path: string; entries: { path: string; type: "file" | "dir" }[] }> {
  "use step"
  const dir = rawDir === "" ? EXEC_SANDBOX_WORKSPACE : resolveWorkspacePath(rawDir)
  const sandbox = await getExecSandbox(agentId)
  // `find` with -mindepth 1 -maxdepth 1 lists immediate children only.
  // We tag each entry with its type via printf so the model gets a
  // structured response without us shelling out twice.
  const list = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-ec",
      `cd ${shellEscape(dir)} && find . -mindepth 1 -maxdepth 1 \\( -type f -printf '%P\\tfile\\n' \\) -o \\( -type d -printf '%P\\tdir\\n' \\) 2>/dev/null || true`,
    ],
  })
  const stdout = await list.stdout()
  const entries = stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, type] = line.split("\t")
      return {
        path: name ?? "",
        type: (type === "dir" ? "dir" : "file") as "file" | "dir",
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
  return { path: dir, entries }
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, `'"'"'`)}'`
}
