import { startupSystemSandbox } from '@/agent-runtime/server/agent-sandbox'

export async function startupSystemSandboxStep(input: {
  agentId: string
}): Promise<void> {
  'use step'
  await startupSystemSandbox({ agentId: input.agentId })
}
