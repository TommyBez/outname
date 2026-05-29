export interface AttachResult {
  error?: string
  ok: boolean
  pendingBuildId?: string
}

export interface AttachOptions {
  refreshSummary?: boolean
  revalidate?: boolean
}
