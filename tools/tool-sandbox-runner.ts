import 'server-only'
import { getOrStartToolSandbox } from '@/lib/tool-sandbox-runtime'

export interface ToolSandboxRunResult {
  exitCode: number
  stderr: string
  stdout: string
}

export async function runToolSandboxCommand(input: {
  args: string[]
  cmd: string
  manifestId: string
  stderrLimit: number
  stdoutLimit: number
}): Promise<ToolSandboxRunResult> {
  'use step'
  const sandbox = await getOrStartToolSandbox(input.manifestId)
  const result = await sandbox.runCommand(input.cmd, input.args)
  const [stdout, stderr] = await Promise.all([result.stdout(), result.stderr()])
  return {
    exitCode: result.exitCode,
    stdout: stdout.slice(0, input.stdoutLimit),
    stderr: stderr.slice(0, input.stderrLimit),
  }
}
