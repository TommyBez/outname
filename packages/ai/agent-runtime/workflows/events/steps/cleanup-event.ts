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
    import('@outname/ai/tools/sandbox-runtime/runtime'),
    import('@outname/ai/tools/runtime/brokered-http/sandbox'),
    import('@outname/ai/tools/runtime/repo-workspace/sandbox'),
    import('@outname/ai/agent-runtime/server/file-cache'),
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
