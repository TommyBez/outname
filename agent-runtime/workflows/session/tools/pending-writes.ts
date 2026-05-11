/**
 * Per-event tracker for immediate file writes. This module is imported by
 * workflow functions, so it must stay workflow-safe: no Node.js built-ins and
 * no sandbox SDK imports. Node/sandbox file helpers live in step-only modules.
 */
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
