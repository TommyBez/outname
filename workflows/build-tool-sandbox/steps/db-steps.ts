import { and, eq, gt } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { agentToolsTag } from '@/lib/cache-tags'
import { db } from '@/lib/db'
import {
  agentTools,
  toolSandboxBuilds,
  toolSandboxSnapshots,
} from '@/lib/db/schema'

/**
 * Phase 4: durable DB mutations used by `buildToolSandboxWorkflow`.
 *
 * Each function is its own `'use step'` so the workflow runtime
 * checkpoints them — replays after a failure don't double-write.
 */

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

/**
 * Finish-line for a successful build:
 *   1. Upsert `tool_sandbox_snapshots` (manifest -> latest snapshot id).
 *   2. Mark the build row `ready`.
 *   3. Flip every `agent_tools` row that was waiting on this manifest
 *      from `pending` to `connected` and clear any sticky error.
 *   4. Revalidate per-agent tool caches so the catalog page sees the
 *      new state on the next request.
 */
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

  // Invalidate per-agent tool caches for every agent that just had a
  // pending row flipped. We don't have the user-id here so we issue a
  // single bulk-revalidate via the manifest tag — but the cache layer
  // is keyed per agent. Easiest correct path: revalidate every agent
  // that has a row referencing this manifest.
  const agentIds = await db
    .selectDistinct({ agentId: agentTools.agentId })
    .from(agentTools)
    .where(eq(agentTools.toolSandboxManifest, input.manifestId))
  for (const { agentId } of agentIds) {
    revalidateTag(agentToolsTag(agentId), 'max')
  }
}

/**
 * Mark the build row failed and stamp the error text onto every
 * `agent_tools` row waiting on this manifest so the catalog UI can
 * surface the message + a Retry button.
 *
 * `agent_tools.status` stays at `pending` — Retry re-runs
 * `attachToolAction` which calls `ensureToolSandboxBuild`; the
 * existing row is reused.
 */
export async function markBuildFailed(input: {
  buildId: string
  error: string
}): Promise<void> {
  'use step'

  // Read the manifest id back from the build row so we can update the
  // matching agent_tools rows.
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

/**
 * Read the manifest's bundled setup-script bytes.
 *
 * Wrapped as a step so the workflow runtime treats the FS read as a
 * checkpointable boundary even though it's just a synchronous module
 * read in practice.
 */
export async function readManifestSetupScript(input: {
  manifestId: string
}): Promise<{ setup: string }> {
  'use step'
  const { manifestSetupScript } = await import('@/tools/sandboxes')
  return { setup: manifestSetupScript(input.manifestId) }
}
