import 'server-only'
import type { AgentEvent } from '@/shared/db/schema'

export const DEFAULT_WORKFLOW_STREAM_RETENTION_DAYS = 7

export function readWorkflowStreamRetentionMs(): number {
  const raw = process.env.WORKFLOW_STREAM_RETENTION_DAYS
  const days = raw ? Number(raw) : DEFAULT_WORKFLOW_STREAM_RETENTION_DAYS
  if (!Number.isFinite(days) || days <= 0) {
    return DEFAULT_WORKFLOW_STREAM_RETENTION_DAYS * 24 * 60 * 60 * 1000
  }
  return days * 24 * 60 * 60 * 1000
}

export function isPastWorkflowStreamRetention(
  event: AgentEvent,
  now: Date
): boolean {
  const anchor = event.startedAt ?? event.queuedAt
  return now.getTime() - anchor.getTime() >= readWorkflowStreamRetentionMs()
}
