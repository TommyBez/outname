// The DB stores only terminal build state; clients read in-flight progress from
// this per-build workflow stream.
export type ToolSandboxBuildEvent =
  | { type: 'progress'; message: string; ts: string }
  | { type: 'ready'; snapshotId: string; ts: string }
  | { type: 'failed'; error: string; ts: string }

export function buildToolSandboxNamespace(buildId: string): string {
  return `tool-sandbox-build:${buildId}`
}
