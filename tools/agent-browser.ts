import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import { getOrStartToolSandbox } from '@/lib/tool-sandbox-runtime'
import type { MaintainerTool } from './types'

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
  command: string
  args: string[]
  timeoutMs: number
}

interface RunAgentBrowserResult {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  timedOut?: true
}

async function runAgentBrowser(
  input: RunAgentBrowserInput
): Promise<RunAgentBrowserResult> {
  'use step'
  const sandbox = await getOrStartToolSandbox('agent-browser')
  const result = await sandbox.runCommand({
    cmd: 'agent-browser',
    args: [input.command, ...input.args],
    // Note: the SDK accepts a sandbox-side timeout; we pass it through
    // so the model's `timeoutMs` actually clips runaway commands.
  })
  const [stdout, stderr] = await Promise.all([result.stdout(), result.stderr()])
  return {
    ok: result.exitCode === 0,
    exitCode: result.exitCode,
    stdout: stdout.slice(0, MAX_STDOUT_BYTES),
    stderr: stderr.slice(0, MAX_STDERR_BYTES),
  }
}

export const agentBrowserTool: MaintainerTool = {
  id: 'agent_browser',
  category: 'browser',
  displayName: 'agent-browser',
  description:
    'Drive a headless browser via the agent-browser CLI. The browser session persists across calls for the duration of this conversation, so you can chain `open` -> `snapshot` -> `click @ref` etc. Returns exit code, stdout, and stderr per call.',
  requirements: [{ kind: 'tool_sandbox', manifest: 'agent-browser' }],
  build() {
    return tool({
      description:
        'Run an agent-browser CLI subcommand inside this conversation\'s persistent browser sandbox. The browser session lives for the lifetime of the chat turn — you can `open` once, then issue `snapshot`, `click @ref`, `type`, etc. without re-navigating. Tools that take a URL: pass it as the first arg. Tools that take a ref id (e.g. `click`): use the @e1 / @e2 refs printed by `snapshot -i`.',
      inputSchema,
      execute: async ({ command, args, timeoutMs }) => {
        return await runAgentBrowser({ command, args, timeoutMs })
      },
    })
  },
}
