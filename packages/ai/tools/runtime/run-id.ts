import { getWorkflowMetadata } from 'workflow'

let fallbackRunId: string | null = null

type RuntimeRunIdGlobal = typeof globalThis & {
  // Namespaced with the app name to avoid collisions with unrelated packages
  // that may also use globalThis hooks inside the shared Node process.
  __outnameToolRuntimeRunIdGetter?: () => string | undefined
}

export function currentToolRuntimeRunId(): string {
  const realtimeRunId = (
    globalThis as RuntimeRunIdGlobal
  ).__outnameToolRuntimeRunIdGetter?.()
  if (realtimeRunId) {
    return realtimeRunId
  }

  if (typeof getWorkflowMetadata === 'function') {
    try {
      const metadata = getWorkflowMetadata()
      if (
        typeof metadata?.workflowRunId === 'string' &&
        metadata.workflowRunId
      ) {
        return metadata.workflowRunId
      }
    } catch {
      // Fall back below for tests and non-workflow server contexts.
    }
  }

  fallbackRunId ??= `standalone-${crypto.randomUUID()}`
  return fallbackRunId
}
