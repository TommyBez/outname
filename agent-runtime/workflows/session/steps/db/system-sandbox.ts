import { startupSystemSandbox } from '@/agent-runtime/server/system-sandbox-startup'

export async function startupSystemSandboxStep(input: {
  agentId: string
}): Promise<void> {
  'use step'
  await startupSystemSandbox({ agentId: input.agentId })
}
