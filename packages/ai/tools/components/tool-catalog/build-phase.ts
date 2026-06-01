import type { AttachedToolView } from './types'

export type ToolCatalogBuildPhase =
  | 'detached'
  | 'ready'
  | 'preparing'
  | 'building'
  | 'failed'

export function toolCatalogBuildPhase(
  attached: AttachedToolView | null
): ToolCatalogBuildPhase {
  if (!attached) {
    return 'detached'
  }
  if (attached.status !== 'pending') {
    return 'ready'
  }
  if (attached.pendingBuildId) {
    return 'building'
  }
  if (attached.toolSandboxError) {
    return 'failed'
  }
  return 'preparing'
}
