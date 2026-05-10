import 'server-only'
import { getOrStartToolSandbox } from '@/tools/sandbox-runtime/runtime'

export interface ToolSandboxRunResult {
  exitCode: number
  stderr: string
  stdout: string
  timedOut?: true
}

export async function runToolSandboxCommand(input: {
  args: string[]
  cmd: string
  manifestId: string
  stderrLimit: number
  stdoutLimit: number
  timeoutMs?: number
  userId: string
}): Promise<ToolSandboxRunResult> {
  'use step'
  const sandbox = await getOrStartToolSandbox({
    manifestId: input.manifestId,
    userId: input.userId,
  })
  const controller = new AbortController()
  const timeoutMs = input.timeoutMs
  let timer: ReturnType<typeof setTimeout> | null = null
  if (timeoutMs !== undefined) {
    // Timers are only allowed inside workflow steps; keep command
    // budgets here instead of in model-visible tool closures.
    timer = setTimeout(() => controller.abort(), timeoutMs)
  }

  try {
    const result = await sandbox.runCommand(input.cmd, input.args, {
      signal: controller.signal,
    })
    const [stdout, stderr] = await Promise.all([
      result.stdout(),
      result.stderr(),
    ])
    return {
      exitCode: result.exitCode,
      stdout: stdout.slice(0, input.stdoutLimit),
      stderr: stderr.slice(0, input.stderrLimit),
    }
  } catch (err) {
    if (controller.signal.aborted) {
      return {
        exitCode: -1,
        stdout: '',
        stderr: `${input.cmd} timed out after ${timeoutMs}ms`,
        timedOut: true,
      }
    }
    throw err
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}
