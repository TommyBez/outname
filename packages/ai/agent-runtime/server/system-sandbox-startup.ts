import 'server-only'
import { ensureSystemSandbox } from '@outname/ai/agent-runtime/server/agent-sandbox'
import { seedBootstrapFilesIfNeeded } from '@outname/shared/agents/server/bootstrap-files'

// Process-local cache: once this process has verified a fresh marker for an
// agent, later events can skip reopening the sandbox just to re-read it.
const verifiedThisProcess = new Set<string>()

// Safe to call every event: ensure the persistent sandbox exists, then seed or
// upgrade the bootstrap files if needed.
export async function startupSystemSandbox(input: {
  agentId: string
}): Promise<void> {
  const { agentId } = input
  const { created } = await ensureSystemSandbox(agentId)

  if (!created && verifiedThisProcess.has(agentId)) {
    return
  }

  await seedBootstrapFilesIfNeeded(agentId)
  verifiedThisProcess.add(agentId)
}
