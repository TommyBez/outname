import { and, eq, gt } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { db } from '@/shared/db'
import {
  agentTools,
  toolSandboxBuilds,
  toolSandboxSnapshots,
} from '@/shared/db/schema'
import { agentToolsTag } from '@/shared/server/cache-tags'

export interface LoadBuildRowResult {
  manifestHash: string
  manifestId: string
}

export async function loadBuildRow(input: {
  buildId: string
}): Promise<LoadBuildRowResult> {
  'use step'
  const [row] = await db
    .select({
      manifestId: toolSandboxBuilds.manifestId,
      manifestHash: toolSandboxBuilds.manifestHash,
    })
    .from(toolSandboxBuilds)
    .where(eq(toolSandboxBuilds.id, input.buildId))
    .limit(1)
  if (!row) {
    throw new Error(`tool_sandbox_builds row not found: ${input.buildId}`)
  }
  return row
}

export async function markBuildRunning(input: {
  buildId: string
}): Promise<void> {
  'use step'
  await db
    .update(toolSandboxBuilds)
    .set({ status: 'running' })
    .where(
      and(
        eq(toolSandboxBuilds.id, input.buildId),
        eq(toolSandboxBuilds.status, 'pending')
      )
    )
}

// Each DB mutation is its own `'use step'` so workflow replays do not
// double-write. Success publishes the snapshot, marks the build ready, updates
// waiting attachments, and revalidates affected agent tool caches.
export async function markBuildReady(input: {
  buildId: string
  manifestId: string
  manifestHash: string
  snapshotId: string
}): Promise<void> {
  'use step'

  const [currentBuild] = await db
    .select({ startedAt: toolSandboxBuilds.startedAt })
    .from(toolSandboxBuilds)
    .where(eq(toolSandboxBuilds.id, input.buildId))
    .limit(1)

  const [newerReadyBuild] = currentBuild
    ? await db
        .select({ id: toolSandboxBuilds.id })
        .from(toolSandboxBuilds)
        .where(
          and(
            eq(toolSandboxBuilds.manifestId, input.manifestId),
            eq(toolSandboxBuilds.status, 'ready'),
            gt(toolSandboxBuilds.startedAt, currentBuild.startedAt)
          )
        )
        .limit(1)
    : []

  const canPublishSnapshot = !newerReadyBuild

  if (canPublishSnapshot) {
    await db
      .insert(toolSandboxSnapshots)
      .values({
        manifestId: input.manifestId,
        snapshotId: input.snapshotId,
        manifestHash: input.manifestHash,
      })
      .onConflictDoUpdate({
        target: toolSandboxSnapshots.manifestId,
        set: {
          snapshotId: input.snapshotId,
          manifestHash: input.manifestHash,
          builtAt: new Date(),
        },
      })
  }

  await db
    .update(toolSandboxBuilds)
    .set({
      status: 'ready',
      finishedAt: new Date(),
      errorText: null,
    })
    .where(
      and(
        eq(toolSandboxBuilds.id, input.buildId),
        eq(toolSandboxBuilds.manifestHash, input.manifestHash)
      )
    )

  if (canPublishSnapshot) {
    await db
      .update(agentTools)
      .set({
        status: 'connected',
        toolSandboxError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agentTools.toolSandboxManifest, input.manifestId),
          eq(agentTools.toolSandboxManifestHash, input.manifestHash),
          eq(agentTools.status, 'pending')
        )
      )
  }

  // Cache tags are per agent, so revalidate every agent that references this
  // manifest instead of trying to fan out through one manifest-wide tag.
  const agentIds = await db
    .selectDistinct({ agentId: agentTools.agentId })
    .from(agentTools)
    .where(eq(agentTools.toolSandboxManifest, input.manifestId))
  for (const { agentId } of agentIds) {
    revalidateTag(agentToolsTag(agentId), 'max')
  }
}

// Failure keeps `agent_tools.status` at `pending` and stamps the error onto the
// waiting rows so Retry can reuse the same attachment and rebuild in place.
export async function markBuildFailed(input: {
  buildId: string
  error: string
}): Promise<void> {
  'use step'
  const [row] = await db
    .select({
      manifestId: toolSandboxBuilds.manifestId,
      manifestHash: toolSandboxBuilds.manifestHash,
    })
    .from(toolSandboxBuilds)
    .where(eq(toolSandboxBuilds.id, input.buildId))
    .limit(1)

  const errorText = input.error.slice(0, 8000)

  await db
    .update(toolSandboxBuilds)
    .set({
      status: 'failed',
      finishedAt: new Date(),
      errorText,
    })
    .where(eq(toolSandboxBuilds.id, input.buildId))

  if (row) {
    await db
      .update(agentTools)
      .set({
        toolSandboxError: errorText,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agentTools.toolSandboxManifest, row.manifestId),
          eq(agentTools.toolSandboxManifestHash, row.manifestHash),
          eq(agentTools.status, 'pending')
        )
      )
  }

  if (row) {
    const agentIds = await db
      .selectDistinct({ agentId: agentTools.agentId })
      .from(agentTools)
      .where(eq(agentTools.toolSandboxManifest, row.manifestId))
    for (const { agentId } of agentIds) {
      revalidateTag(agentToolsTag(agentId), 'max')
    }
  }
}

// Keep the manifest setup-script read inside a step so the workflow runtime
// checkpoints the boundary even though the module read is synchronous.
export async function readManifestSetupScript(input: {
  manifestId: string
}): Promise<{ setup: string }> {
  'use step'
  const { manifestSetupScript } = await import('@/tools/sandboxes')
  return { setup: manifestSetupScript(input.manifestId) }
}
