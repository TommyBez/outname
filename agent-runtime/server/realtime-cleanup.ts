import 'server-only'
import { refreshAgentFileCache } from '@/agent-runtime/server/file-cache'
import { stopAllBrokeredHttpSandboxesForRun } from '@/tools/runtime/brokered-http/sandbox'
import { stopAllRepoWorkspacesForRun } from '@/tools/runtime/repo-workspace/sandbox'
import { stopAllToolSandboxesForRun } from '@/tools/sandbox-runtime/runtime'

export async function cleanupRealtimeRun(input: {
  agentId: string
}): Promise<void> {
  await Promise.all([
    bestEffort('stopAllToolSandboxesForRun', () =>
      stopAllToolSandboxesForRun()
    ),
    bestEffort('stopAllBrokeredHttpSandboxesForRun', () =>
      stopAllBrokeredHttpSandboxesForRun()
    ),
    bestEffort('stopAllRepoWorkspacesForRun', () =>
      stopAllRepoWorkspacesForRun()
    ),
    bestEffort(
      'refreshAgentFileCache',
      () => refreshAgentFileCache(input.agentId),
      {
        ignore: isMissingSystemSandboxError,
        onIgnored: (err) => {
          console.warn(
            '[realtime-cleanup] refreshAgentFileCache skipped; system sandbox is missing',
            {
              agentId: input.agentId,
              sandboxName: readErrorString(err, 'sandboxName'),
            }
          )
        },
      }
    ),
  ])
}

async function bestEffort(
  label: string,
  fn: () => Promise<unknown>,
  options: {
    ignore?: (err: unknown) => boolean
    onIgnored?: (err: unknown) => void
  } = {}
): Promise<void> {
  try {
    await fn()
  } catch (err) {
    if (options.ignore?.(err)) {
      options.onIgnored?.(err)
      return
    }
    console.error(`[realtime-cleanup] ${label} failed`, err)
  }
}

function isMissingSystemSandboxError(err: unknown): boolean {
  return (
    Boolean(readErrorString(err, 'sandboxName')) &&
    (readErrorNumber(err, 'response.status') === 404 ||
      readErrorString(err, 'json.error.code') === 'not_found')
  )
}

function readErrorNumber(err: unknown, path: string): number | undefined {
  const value = readErrorValue(err, path)
  return typeof value === 'number' ? value : undefined
}

function readErrorString(err: unknown, path: string): string | undefined {
  const value = readErrorValue(err, path)
  return typeof value === 'string' ? value : undefined
}

function readErrorValue(err: unknown, path: string): unknown {
  let current = err
  for (const key of path.split('.')) {
    if (!isRecord(current)) {
      return
    }
    current = current[key]
  }
  return current
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
