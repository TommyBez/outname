import { and, eq } from 'drizzle-orm'
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
  manifestId: string
  manifestHash: string
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
 * Atomic finish-line for a successful build:
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

  await db.transaction(async (tx) => {
    await tx
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

    await tx
      .update(toolSandboxBuilds)
      .set({
        status: 'ready',
        finishedAt: new Date(),
        errorText: null,
      })
      .where(eq(toolSandboxBuilds.id, input.buildId))

    await tx
      .update(agentTools)
      .set({
        status: 'connected',
        toolSandboxError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agentTools.toolSandboxManifest, input.manifestId),
          eq(agentTools.status, 'pending')
        )
      )
  })

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
    .select({ manifestId: toolSandboxBuilds.manifestId })
    .from(toolSandboxBuilds)
    .where(eq(toolSandboxBuilds.id, input.buildId))
    .limit(1)

  await db.transaction(async (tx) => {
    await tx
      .update(toolSandboxBuilds)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        errorText: input.error.slice(0, 8_000),
      })
      .where(eq(toolSandboxBuilds.id, input.buildId))

    if (row) {
      await tx
        .update(agentTools)
        .set({
          toolSandboxError: input.error.slice(0, 8_000),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(agentTools.toolSandboxManifest, row.manifestId),
            eq(agentTools.status, 'pending')
          )
        )
    }
  })

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
 * Read the manifest's `setup.sh` script bytes.
 *
 * Wrapped as a step so the workflow runtime treats the FS read as a
 * checkpointable boundary even though it's just a synchronous file
 * read in practice.
 */
export async function readManifestSetupScript(input: {
  manifestId: string
}): Promise<{ setup: string }> {
  'use step'
  const { manifestSetupScript } = await import('@/tools/sandboxes')
  return { setup: manifestSetupScript(input.manifestId) }
}

