import {
  getSystemSandbox,
  SYSTEM_SANDBOX_ROOT,
} from '@/agent-runtime/server/agent-sandbox'
import { buildAgentsMdContent } from '@/agents/server/agents-md-template'
import {
  listUnappliedPendingFileWrites,
  markPendingFileWritesApplied,
} from '@/agents/server/pending-writes'

// Drain pending bootstrap-file edits before prompt composition so the model
// sees the latest operator-authored content. If the write succeeds but marking
// rows applied fails, the retry is still safe because the writes are idempotent.
export async function drainPendingWrites(input: {
  agentId: string
}): Promise<{ applied: number }> {
  'use step'
  const { agentId } = input

  const queued = await listUnappliedPendingFileWrites({ agentId })
  if (queued.length === 0) {
    return { applied: 0 }
  }

  const sandbox = await getSystemSandbox(agentId)

  // Queue paths are relative, but the Sandbox SDK writes absolute paths. Prefix
  // them here so bootstrap-file edits land where `composeSystemPrompt` reads.
  await sandbox.writeFiles(
    queued.map((row) => ({
      path: `${SYSTEM_SANDBOX_ROOT}/${row.path}`,
      content: Buffer.from(contentForPendingWrite(row), 'utf8'),
    }))
  )

  await markPendingFileWritesApplied({ ids: queued.map((r) => r.id) })

  return { applied: queued.length }
}

function contentForPendingWrite(row: {
  content: string
  path: string
}): string {
  if (row.path === 'AGENTS.md') {
    return buildAgentsMdContent({ customInstructions: row.content })
  }
  return row.content
}
