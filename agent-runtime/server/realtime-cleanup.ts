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
    bestEffort('refreshAgentFileCache', () =>
      refreshAgentFileCache(input.agentId)
    ),
  ])
}

async function bestEffort(
  label: string,
  fn: () => Promise<unknown>
): Promise<void> {
  try {
    await fn()
  } catch (err) {
    console.error(`[realtime-cleanup] ${label} failed`, err)
  }
}
