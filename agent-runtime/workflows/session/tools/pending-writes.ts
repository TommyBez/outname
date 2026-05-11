// Imported by workflow code, so keep this module workflow-safe: no Node
// built-ins or sandbox SDK imports.
export interface PendingWrites {
  beforeByPath: Record<string, string | null>
}

export function createPendingWrites(): PendingWrites {
  return { beforeByPath: {} }
}

export function rememberReviewBefore(
  pending: PendingWrites,
  path: string,
  before: string | null
): void {
  if (path in pending.beforeByPath) {
    return
  }
  pending.beforeByPath[path] = before
}

export function reviewPathsFromPending(pending: PendingWrites): string[] {
  return Object.keys(pending.beforeByPath).sort()
}
