import 'server-only'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { toolInvocations } from '@/lib/db/schema'
import type { ToolErrorCode } from './types'

const MAX_AUDIT_ERROR_MESSAGE_CHARS = 4000

function clipAuditErrorMessage(message: string | null): string | null {
  return message?.slice(0, MAX_AUDIT_ERROR_MESSAGE_CHARS) ?? null
}

export async function recordToolInvocation(input: {
  agentId: string
  conversationId: string | null
  durationMs: number
  errorCode: ToolErrorCode | null
  errorMessage: string | null
  kind: string
  ok: boolean
  runId: string | null
  toolId: string
  userId: string
}): Promise<void> {
  'use step'
  try {
    await db.insert(toolInvocations).values({
      id: `tinv_${randomUUID()}`,
      agentId: input.agentId,
      userId: input.userId,
      runId: input.runId,
      conversationId: input.conversationId,
      toolId: input.toolId,
      kind: input.kind,
      ok: input.ok,
      durationMs: input.durationMs,
      errorCode: input.errorCode,
      errorMessage: clipAuditErrorMessage(input.errorMessage),
    })
  } catch (err) {
    console.error('[v0] recordToolInvocation failed', {
      agentId: input.agentId,
      toolId: input.toolId,
      err,
    })
  }
}
