import 'server-only'
import { z } from 'zod'
import {
  defineSandboxTool,
  toolError,
  toolSuccess,
} from './define-maintainer-tool'

/**
 * Phase 4: agent-browser tool.
 *
 * Single tool that exposes the **entire** agent-browser CLI rather
 * than wrapping a single hardcoded action. The model picks the
 * subcommand and arguments it needs (`open`, `close`, `snapshot`,
 * `click`, `screenshot`, etc., 50+ commands per agent-browser docs).
 *
 * Why one tool, not 50: each subcommand has different argument shapes
 * and flags; modelling them as separate AI-SDK tools would multiply
 * registry surface for no benefit. The model already knows
 * agent-browser's CLI, and the tool description points it at the
 * docs.
 *
 * Session continuity: agent-browser keeps a persistent daemon inside
 * the sandbox, so `open <url>` followed by `snapshot -i` followed by
 * `click @e2` share the same browser session. We deliberately do NOT
 * close the session between calls — `lib/tool-sandbox-runtime.ts`
 * caches the sandbox per workflow run and `endOfEvent` is the only
 * thing that tears it down.
 */

const MAX_STDOUT_BYTES = 64 * 1024
const MAX_STDERR_BYTES = 8 * 1024

/**
 * Curated list of known agent-browser subcommands. The model is
 * encouraged to stick to these; unknown subcommands are still
 * forwarded to the CLI (the model can recover from a clean exit-code
 * + stderr error). The list is informational for the LLM, not a
 * hard whitelist.
 */
const KNOWN_COMMANDS = [
  'open',
  'close',
  'snapshot',
  'screenshot',
  'click',
  'type',
  'press',
  'eval',
  'goto',
  'reload',
  'back',
  'forward',
  'wait',
  'network',
  'storage',
  'list',
  'select',
  'hover',
  'scroll',
  'upload',
  'download',
  'cookies',
  'frames',
] as const

const inputSchema = z.object({
  command: z
    .string()
    .min(1)
    .describe(
      `agent-browser subcommand. See https://agent-browser.dev for the full reference. Common: ${KNOWN_COMMANDS.join(', ')}.`
    ),
  args: z
    .array(z.string())
    .default([])
    .describe(
      'Positional + flag arguments to pass to the subcommand, in order. Example: ["https://example.com"] for `open`, or ["-i", "-c"] for `snapshot`. Quoting is handled by the runtime.'
    ),
  timeoutMs: z
    .number()
    .int()
    .min(500)
    .max(120_000)
    .default(30_000)
    .describe(
      'Per-call wall-clock budget. Most commands return in under 5 seconds; bump this only when you expect a long page load or a long script.'
    ),
})

interface RunAgentBrowserInput {
  args: string[]
  command: string
  timeoutMs: number
}

interface RunAgentBrowserResult {
  exitCode: number
  ok: boolean
  stderr: string
  stdout: string
  timedOut?: true
}

async function runAgentBrowser(input: {
  run: (args: {
    args: string[]
    cmd: string
    stderrLimit?: number
    stdoutLimit?: number
  }) => Promise<{ exitCode: number; stderr: string; stdout: string }>
  value: RunAgentBrowserInput
}): Promise<RunAgentBrowserResult> {
  // The Vercel Sandbox SDK doesn't expose a per-command wall-clock
  // budget directly, so we race the run against a JS-side timeout.
  // The runaway command keeps running inside the sandbox until the
  // sandbox itself is stopped at end-of-event — that's acceptable
  // because tool sandboxes are scoped to one workflow run.
  const exec = (async () => {
    const result = await input.run({
      cmd: 'agent-browser',
      args: [input.value.command, ...input.value.args],
      stdoutLimit: MAX_STDOUT_BYTES,
      stderrLimit: MAX_STDERR_BYTES,
    })
    return {
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    } satisfies RunAgentBrowserResult
  })()

  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<RunAgentBrowserResult>((resolve) => {
    timer = setTimeout(() => {
      resolve({
        ok: false,
        exitCode: -1,
        stdout: '',
        stderr: `agent-browser ${input.value.command} timed out after ${input.value.timeoutMs}ms`,
        timedOut: true,
      })
    }, input.value.timeoutMs)
  })

  try {
    return await Promise.race([exec, timeout])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

export const agentBrowserTool = defineSandboxTool({
  id: 'agent_browser',
  category: 'browser',
  displayName: 'agent-browser',
  description:
    'Drive a headless browser via the agent-browser CLI. The browser session persists across calls for the duration of this conversation, so you can chain `open` -> `snapshot` -> `click @ref` etc. Returns exit code, stdout, and stderr per call.',
  manifestId: 'agent-browser',
  inputSchema,
  async execute({ input: { command, args, timeoutMs }, ctx }) {
    const result = await runAgentBrowser({
      run: ctx.sandbox.run,
      value: { command, args: args ?? [], timeoutMs: timeoutMs ?? 30_000 },
    })
    if (result.timedOut) {
      return toolError('provider_error', result.stderr)
    }
    return toolSuccess(result)
  },
})
