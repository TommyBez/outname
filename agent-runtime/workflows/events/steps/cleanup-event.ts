export async function cleanupEventResources(input: {
  agentId: string
}): Promise<void> {
  'use step'
  const [
    { stopAllToolSandboxesForRun },
    { stopAllBrokeredHttpSandboxesForRun },
    { stopAllRepoWorkspacesForRun },
    { refreshAgentFileCache },
  ] = await Promise.all([
    import('@/tools/sandbox-runtime/runtime'),
    import('@/tools/runtime/brokered-http/sandbox'),
    import('@/tools/runtime/repo-workspace/sandbox'),
    import('@/agent-runtime/server/file-cache'),
  ])

  await Promise.all([
    stopAllToolSandboxesForRun(),
    stopAllBrokeredHttpSandboxesForRun(),
    stopAllRepoWorkspacesForRun(),
    refreshAgentFileCache(input.agentId).catch((err) => {
      console.error('[events] refreshAgentFileCache failed', err)
    }),
  ])
}
