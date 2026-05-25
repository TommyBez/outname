export async function startupSystemSandboxStep(input: {
  agentId: string
}): Promise<void> {
  'use step'
  const { startupSystemSandbox } = await import(
    '@/agent-runtime/server/agent-sandbox'
  )
  await startupSystemSandbox({ agentId: input.agentId })
}
