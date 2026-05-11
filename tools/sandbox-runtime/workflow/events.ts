/**
 * Phase 4: per-build progress event union and stream namespace.
 *
 * Emitted from inside `buildToolSandboxWorkflow` (and its `run-sandbox-
 * build` step) and consumed by the
 * `/api/tool-sandbox-builds/[buildId]/stream` route. The DB only keeps
 * terminal state; this stream is the single source of truth for
 * in-flight progress messages.
 */
export type ToolSandboxBuildEvent =
  | { type: 'progress'; message: string; ts: string }
  | { type: 'ready'; snapshotId: string; ts: string }
  | { type: 'failed'; error: string; ts: string }

export function buildToolSandboxNamespace(buildId: string): string {
  return `tool-sandbox-build:${buildId}`
}
