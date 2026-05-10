import 'server-only'
import { type NetworkPolicy, Sandbox } from '@vercel/sandbox'
import { eq } from 'drizzle-orm'
import { getWorkflowMetadata } from 'workflow'
import { getConnector } from '@/connections/registry'
import { readBrokeredCredential } from '@/connections/runtime/credential'
import { db } from '@/shared/db'
import { toolSandboxSnapshots } from '@/shared/db/schema'
import { toolRuntimeSandboxTags } from '@/shared/server/vercel-sandbox-config'
import { validateInjectedHeaders } from '@/tools/runtime/brokered-http/validation'
import { getToolSandboxManifest } from '@/tools/sandboxes'

/**
 * Phase 4: per-run tool-sandbox runtime.
 *
 * The first call within a workflow run that needs manifest M lazily
 * spawns a Vercel Sandbox from M's snapshot, caches the handle keyed by
 * the current `workflowRunId`, and returns it. Subsequent calls inside
 * the same run reuse the cached handle — that's what keeps
 * agent-browser's persistent daemon alive across `open` → `snapshot` →
 * `click` etc.
 *
 * `endOfEvent` calls `stopAllToolSandboxesForRun()` which stops every
 * cached sandbox for the current run and clears the entry. The next
 * event in the same session will boot fresh.
 *
 * The cache lives in module memory. Because workflow steps may run on
 * different worker instances, the cache is best-effort: a cache miss
 * just spawns a new sandbox from the snapshot. agent-browser's daemon
 * surviving across calls is a happy-path optimisation, not a
 * correctness requirement.
 */

/** Subset of `Sandbox` the maintainer tools actually use. */
export interface ToolSandboxHandle {
  runCommand: Sandbox['runCommand']
}

interface CachedSandbox {
  cacheKey: string
  manifestId: string
  sandbox: Sandbox
}

const cache = new Map<string, Map<string, CachedSandbox>>()

class ToolSandboxUnavailableError extends Error {
  readonly manifestId: string
  constructor(manifestId: string, message: string) {
    super(message)
    this.manifestId = manifestId
    this.name = 'ToolSandboxUnavailableError'
  }
}

export { ToolSandboxUnavailableError }

function currentRunId(): string {
  // `getWorkflowMetadata()` is available inside `'use step'` bodies and
  // returns the runtime id of the workflow that's currently executing
  // — for tool calls, the long-lived agent session run.
  return getWorkflowMetadata().workflowRunId
}

async function readSnapshotId(manifestId: string): Promise<string | null> {
  const [row] = await db
    .select({ snapshotId: toolSandboxSnapshots.snapshotId })
    .from(toolSandboxSnapshots)
    .where(eq(toolSandboxSnapshots.manifestId, manifestId))
    .limit(1)
  return row?.snapshotId ?? null
}

/**
 * Get-or-create the sandbox for `manifestId` in the current workflow
 * run. Throws `ToolSandboxUnavailableError` if no snapshot exists yet
 * (the attach action is supposed to have built one before the tool
 * shows up to the model, so this is treated as a programming error).
 *
 * Must be called from inside a workflow step (`'use step'` body) so
 * `getWorkflowMetadata` works.
 */
export async function getOrStartToolSandbox(input: {
  manifestId: string
  userId: string
}): Promise<ToolSandboxHandle> {
  const runId = currentRunId()
  const manifest = getToolSandboxManifest(input.manifestId)
  const cacheKey = sandboxCacheKey({
    manifestId: input.manifestId,
    userId: input.userId,
    manifest,
  })

  let perRun = cache.get(runId)
  if (perRun) {
    const cached = perRun.get(cacheKey)
    if (cached) {
      return cached.sandbox
    }
  }

  // Reading the manifest also asserts it's still registered — a
  // tool whose manifest was removed from the registry shouldn't be
  // spawnable even if a stale snapshot row exists.
  const snapshotId = await readSnapshotId(input.manifestId)
  if (!snapshotId) {
    throw new ToolSandboxUnavailableError(
      input.manifestId,
      `Tool sandbox snapshot for manifest "${input.manifestId}" is not built yet.`
    )
  }
  const networkPolicy = await resolveRuntimeNetworkPolicy({
    manifest,
    userId: input.userId,
  })

  // `runtime` is intentionally not passed: when sourcing from a
  // snapshot, the SDK rejects `runtime` (it's already encoded in the
  // snapshot itself).
  const sandbox = await Sandbox.create({
    source: { type: 'snapshot', snapshotId },
    persistent: false,
    tags: toolRuntimeSandboxTags({ manifestId: input.manifestId, runId }),
    timeout: 600_000,
    ...(networkPolicy ? { networkPolicy } : {}),
  })

  if (!perRun) {
    perRun = new Map()
    cache.set(runId, perRun)
  }
  perRun.set(cacheKey, { cacheKey, manifestId: input.manifestId, sandbox })

  return sandbox
}

/**
 * Stop every cached tool sandbox for the current workflow run. Called
 * by `endOfEvent` so each event boots fresh sandboxes (matches the
 * lifecycle of the system sandbox).
 *
 * Errors are logged and swallowed — a failed stop must never fail an
 * otherwise-successful event.
 */
export async function stopAllToolSandboxesForRun(): Promise<void> {
  let runId: string
  try {
    runId = currentRunId()
  } catch {
    // Outside a workflow context — nothing to clean up.
    return
  }

  const perRun = cache.get(runId)
  if (!perRun || perRun.size === 0) {
    cache.delete(runId)
    return
  }

  await Promise.all(
    Array.from(perRun.values()).map(async ({ manifestId, sandbox }) => {
      try {
        await sandbox.stop()
      } catch (err) {
        console.error(
          '[v0] stopAllToolSandboxesForRun: stop failed',
          manifestId,
          err
        )
      }
    })
  )
  cache.delete(runId)
}

function sandboxCacheKey(input: {
  manifest: ReturnType<typeof getToolSandboxManifest>
  manifestId: string
  userId: string
}): string {
  const providerCount =
    input.manifest.runtimeNetwork?.brokeredProviders?.length ?? 0
  if (providerCount === 0) {
    return input.manifestId
  }
  return `${input.manifestId}:${input.userId}`
}

async function resolveRuntimeNetworkPolicy(input: {
  manifest: ReturnType<typeof getToolSandboxManifest>
  userId: string
}): Promise<NetworkPolicy | undefined> {
  const brokeredProviders =
    input.manifest.runtimeNetwork?.brokeredProviders ?? []
  const unauthenticatedHosts =
    input.manifest.runtimeNetwork?.unauthenticatedHosts ?? []
  if (brokeredProviders.length === 0 && unauthenticatedHosts.length === 0) {
    return
  }

  const allow: Record<
    string,
    { transform: { headers: Record<string, string> }[] }[]
  > = {}

  for (const provider of brokeredProviders) {
    const connector = getConnector(provider)
    if (!connector) {
      throw new ToolSandboxUnavailableError(
        input.manifest.id,
        `Tool sandbox manifest "${input.manifest.id}" references unknown provider "${provider}".`
      )
    }
    const credential = await readBrokeredCredential({
      provider,
      userId: input.userId,
    })
    const injectedHeaders = validateInjectedHeaders(
      provider,
      connector.broker.injectedHeaderNames,
      connector.broker.injectedHeaders(credential)
    )
    for (const host of connector.broker.allowedHosts) {
      mergeAuthenticatedHost({
        allow,
        host,
        headers: injectedHeaders,
        manifestId: input.manifest.id,
      })
    }
  }

  for (const host of unauthenticatedHosts) {
    if (host in allow) {
      throw new ToolSandboxUnavailableError(
        input.manifest.id,
        `Tool sandbox manifest "${input.manifest.id}" declares host "${host}" as both authenticated and unauthenticated.`
      )
    }
    allow[host] = []
  }

  return { allow } as NetworkPolicy
}

function mergeAuthenticatedHost(input: {
  allow: Record<string, { transform: { headers: Record<string, string> }[] }[]>
  headers: Record<string, string>
  host: string
  manifestId: string
}): void {
  const existing = input.allow[input.host]
  if (!existing) {
    input.allow[input.host] = [{ transform: [{ headers: input.headers }] }]
    return
  }
  if (existing.length === 0) {
    throw new ToolSandboxUnavailableError(
      input.manifestId,
      `Tool sandbox manifest "${input.manifestId}" declares host "${input.host}" as both authenticated and unauthenticated.`
    )
  }
  const currentHeaders = existing[0]?.transform[0]?.headers ?? {}
  if (!sameHeaders(currentHeaders, input.headers)) {
    throw new ToolSandboxUnavailableError(
      input.manifestId,
      `Tool sandbox manifest "${input.manifestId}" resolved conflicting injected headers for host "${input.host}".`
    )
  }
}

function sameHeaders(
  left: Record<string, string>,
  right: Record<string, string>
): boolean {
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  for (const [index, key] of leftKeys.entries()) {
    if (key !== rightKeys[index]) {
      return false
    }
    if (left[key] !== right[key]) {
      return false
    }
  }
  return true
}
