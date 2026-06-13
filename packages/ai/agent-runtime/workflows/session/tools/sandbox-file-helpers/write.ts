import type { Sandbox } from '@vercel/sandbox'

export async function ensureParentDirectories(input: {
  commandName?: string
  paths: readonly string[]
  root: string
  sandbox: Pick<Sandbox, 'runCommand'>
}): Promise<void> {
  const dirs = [
    ...new Set(
      input.paths
        .map((path) => pathDirname(path, input.root))
        .filter((dir) => dir !== input.root)
    ),
  ]
  if (dirs.length === 0) {
    return
  }

  let result: Awaited<ReturnType<Sandbox['runCommand']>>
  try {
    result = await input.sandbox.runCommand({
      args: ['-p', ...dirs],
      cmd: 'mkdir',
    })
  } catch (error) {
    throw new Error(
      `${input.commandName ?? 'writeFile'}: ${errorMessage(error)}`
    )
  }
  if (result.exitCode !== 0) {
    const stderr = await result.stderr()
    throw new Error(
      stderr.trim() ||
        `${input.commandName ?? 'writeFile'}: failed to create ${dirs.join(', ')}`
    )
  }
}

function pathDirname(absPath: string, root: string): string {
  if (absPath === root) {
    return root
  }
  const slashIndex = absPath.lastIndexOf('/')
  return slashIndex > 0 ? absPath.slice(0, slashIndex) : root
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
