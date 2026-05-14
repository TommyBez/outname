import { seedBootstrapFilesIfNeeded } from '@/agents/server/bootstrap-files'

// Process-local cache: once this process has verified a fresh marker for an
// agent, later events can skip reopening the sandbox just to re-read it.
const verifiedThisProcess = new Set<string>()

// Seed bootstrap files on first boot and re-seed only when the marker changes.
// Once the marker matches, later events leave the agent's own notes alone and
// skip redundant sandbox reads when this process already verified the marker.
export async function seedAgentsMd(input: {
  agentId: string
  created?: boolean
}): Promise<void> {
  'use step'
  const { agentId, created = true } = input

  if (!created && verifiedThisProcess.has(agentId)) {
    return
  }

  await seedBootstrapFilesIfNeeded(agentId)
  verifiedThisProcess.add(agentId)
}
