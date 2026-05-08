import type { PendingWrites } from '../pending-writes'

export interface FileToolsContext {
  agentId: string
  pending: PendingWrites
}

export interface ReviewBefore {
  before: string | null
  path: string
}
