const APP_TAG = 'personal-assistant-agent'
const DEFAULT_ENV_TAG = 'development'

function sandboxEnv(): string {
  return (
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    process.env.SANDBOX_ENV ??
    DEFAULT_ENV_TAG
  )
}

function baseSandboxTags(): Record<string, string> {
  return {
    app: APP_TAG,
    env: sandboxEnv(),
  }
}

export function systemSandboxTags(agentId: string): Record<string, string> {
  return {
    ...baseSandboxTags(),
    kind: 'agent-system',
    agentId,
  }
}

export function toolRuntimeSandboxTags(input: {
  manifestId: string
  runId: string
}): Record<string, string> {
  return {
    ...baseSandboxTags(),
    kind: 'tool-runtime',
    manifestId: input.manifestId,
    runId: input.runId,
  }
}

export function toolBuildSandboxTags(input: {
  buildId: string
  manifestId: string
}): Record<string, string> {
  return {
    ...baseSandboxTags(),
    kind: 'tool-build',
    manifestId: input.manifestId,
    buildId: input.buildId,
  }
}

export function brokeredHttpSandboxTags(input: {
  provider: string
  runId: string
}): Record<string, string> {
  return {
    ...baseSandboxTags(),
    kind: 'brokered-http',
    provider: input.provider,
    runId: input.runId,
  }
}
