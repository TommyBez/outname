import type { Sandbox } from '@vercel/sandbox'
import {
  FILE_TOOL_SANDBOX_ROOT,
  isSafeRelativePath,
  isTrackedArchitecturePath,
  matchesPrefix,
  normalizeSandboxPrefix,
  relativeToSandboxRoot,
} from './paths'

const MAX_LIST_RESULTS = 1000

export async function listLiveFiles(
  sandbox: Sandbox,
  input: {
    maxResults?: number
    pathPrefix?: string
  } = {}
): Promise<{ paths: string[]; truncated: boolean }> {
  const maxResults = Math.min(
    Math.max(input.maxResults ?? MAX_LIST_RESULTS, 1),
    MAX_LIST_RESULTS
  )
  const paths = await listAllLiveFilePaths(sandbox, input.pathPrefix)

  return {
    paths: paths.slice(0, maxResults),
    truncated: paths.length > maxResults,
  }
}

export async function listTrackedArchitectureFiles(
  sandbox: Sandbox
): Promise<string[]> {
  const paths = await listAllLiveFilePaths(sandbox)
  return paths.filter(isTrackedArchitecturePath).sort()
}

async function listAllLiveFilePaths(
  sandbox: Sandbox,
  pathPrefix?: string
): Promise<string[]> {
  const prefix = normalizeSandboxPrefix(pathPrefix)
  let list: Awaited<ReturnType<Sandbox['runCommand']>>
  try {
    list = await sandbox.runCommand({
      cmd: 'find',
      args: [FILE_TOOL_SANDBOX_ROOT, '-type', 'f', '-print'],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`listFiles: ${message}`)
  }
  const stdout = await list.stdout()
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((absPath) => relativeToSandboxRoot(absPath))
    .filter((relPath) => isSafeRelativePath(relPath))
    .filter((relPath) => matchesPrefix(relPath, prefix.relPath))
    .sort()
}
