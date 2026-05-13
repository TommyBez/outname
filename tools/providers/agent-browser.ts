import 'server-only'
import { z } from 'zod'
import {
  defineSandboxTool,
  toolError,
  toolSuccess,
} from '@/tools/runtime/define-maintainer-tool'

const MAX_STDOUT_BYTES = 64 * 1024
const MAX_STDERR_BYTES = 8 * 1024

// Informational list for the model; unknown commands still pass through to the CLI.
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
      `agent-browser subcommand. This sandbox pins agent-browser to the Lightpanda engine. See https://agent-browser.dev for the full reference. Common: ${KNOWN_COMMANDS.join(', ')}.`
    ),
  args: z
    .array(z.string())
    .default([])
    .describe(
      'Positional + flag arguments to pass to the subcommand, in order. Example: ["https://example.com"] for `open`, or ["-i", "-c"] for `snapshot`. Quoting is handled by the runtime. Chrome-only flags such as headed mode, persistent profiles, storage state, and file access are unavailable under the Lightpanda engine.'
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
    timeoutMs?: number
  }) => Promise<{
    exitCode: number
    stderr: string
    stdout: string
    timedOut?: true
  }>
  value: RunAgentBrowserInput
}): Promise<RunAgentBrowserResult> {
  const result = await input.run({
    cmd: 'agent-browser',
    args: [input.value.command, ...input.value.args],
    stdoutLimit: MAX_STDOUT_BYTES,
    stderrLimit: MAX_STDERR_BYTES,
    timeoutMs: input.value.timeoutMs,
  })
  if (result.timedOut) {
    return {
      ok: false,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: `agent-browser ${input.value.command} timed out after ${input.value.timeoutMs}ms`,
      timedOut: true,
    }
  }
  return {
    ok: result.exitCode === 0,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

export const agentBrowserTool = defineSandboxTool({
  id: 'agent_browser',
  category: 'browser',
  displayName: 'agent-browser',
  description:
    'Drive a headless browser via the agent-browser CLI configured for the Lightpanda engine in this sandbox. The browser session persists across calls for the duration of this conversation, so you can chain `open` -> `snapshot` -> `click @ref` etc. Chrome-only features such as headed mode, persistent profiles, storage state, and file access are unavailable; screenshot support depends on Lightpanda CDP coverage. Returns exit code, stdout, and stderr per call.',
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
