import 'server-only'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { toolInvocations } from '@/lib/db/schema'
import type { ToolErrorCode } from './types'

export async function recordToolInvocation(input: {
  agentId: string
  durationMs: number
  errorCode: ToolErrorCode | null
  kind: string
  ok: boolean
  toolId: string
}): Promise<void> {
  'use step'
  try {
    await db.insert(toolInvocations).values({
      id: `tinv_${randomUUID()}`,
      agentId: input.agentId,
      toolId: input.toolId,
      kind: input.kind,
      ok: input.ok,
      durationMs: input.durationMs,
      errorCode: input.errorCode,
    })
  } catch (err) {
    console.error('[v0] recordToolInvocation failed', {
      agentId: input.agentId,
      toolId: input.toolId,
      err,
    })
  }
}
