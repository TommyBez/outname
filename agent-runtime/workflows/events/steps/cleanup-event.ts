import { refreshAgentFileCache } from '@/agent-runtime/server/file-cache'
import { stopAllBrokeredHttpSandboxesForRun } from '@/tools/runtime/brokered-http/sandbox'
import { stopAllRepoWorkspacesForRun } from '@/tools/runtime/repo-workspace/sandbox'
import { stopAllToolSandboxesForRun } from '@/tools/sandbox-runtime/runtime'

export async function cleanupEventResources(input: {
  agentId: string
}): Promise<void> {
  'use step'
  await Promise.all([
    stopAllToolSandboxesForRun(),
    stopAllBrokeredHttpSandboxesForRun(),
    stopAllRepoWorkspacesForRun(),
    refreshAgentFileCache(input.agentId).catch((err) => {
      console.error('[events] refreshAgentFileCache failed', err)
    }),
  ])
}
