import { Sandbox, Snapshot } from '@vercel/sandbox'
import {
  getVercelSandboxCredentials,
  PERSISTENT_SANDBOX_RETENTION_OPTIONS,
  withVercelSandboxCredentials,
} from './vercel-sandbox-config'

export const BYTES_PER_GB = 1_000_000_000
export const DEFAULT_CRON_SNAPSHOT_CLEANUP_OLDER_THAN_DAYS = 1
export const SANDBOX_STORAGE_USD_PER_GB_MONTH = 0.08

const DAY_IN_MS = 24 * 60 * 60_000
const VERCEL_PAGE_LIMIT = 50

export interface CleanupFailure {
  error: unknown
  target: string
}

export interface CleanupFailureSummary {
  message: string
  target: string
}

export interface PaginatedSandboxes {
  pagination: {
    next?: string | null
  }
  sandboxes: SandboxRecord[]
}

export interface PaginatedSnapshots {
  pagination: {
    next?: string | null
  }
  snapshots: SnapshotRecord[]
}

export interface ProjectRef {
  id: string
  name: string
}

export interface SandboxRecord {
  currentSnapshotId?: string
  keepLastSnapshots?: {
    count?: number
    deleteEvicted?: boolean
    expiration?: number
  }
  name: string
  persistent: boolean
  snapshotExpiration?: number
  status?: string
}

export interface SandboxSnapshotCleanupClient {
  deleteSnapshot(input: { snapshotId: string }): Promise<void>
  listSandboxes(input: {
    cursor?: string
    limit: number
  }): Promise<PaginatedSandboxes>
  listSnapshots(input: {
    cursor?: string
    limit: number
    sandboxName: string
  }): Promise<PaginatedSnapshots>
  updateSandboxRetention(input: { sandboxName: string }): Promise<void>
}

export interface SandboxSnapshotPlan {
  candidates: SnapshotCandidate[]
  createdSnapshotBytes: number
  createdSnapshotCount: number
  currentSnapshotId: string | undefined
  needsRetentionUpdate: boolean
  sandbox: SandboxRecord
}

export interface SnapshotCandidate {
  sandboxName: string
  snapshot: SnapshotRecord
}

export interface SnapshotRecord {
  createdAt: number
  expiresAt?: number
  id: string
  lastUsedAt?: number
  parentId?: string
  sizeBytes: number
  sourceSessionId?: string
  status: string
}

export interface VercelSandboxSnapshotCleanupOptions {
  client?: SandboxSnapshotCleanupClient
  execute: boolean
  now?: number
  olderThanDays: number | null
  sandboxName?: string | null
}

export interface VercelSandboxSnapshotCleanupPlan {
  candidateBytes: number
  candidates: SnapshotCandidate[]
  createdSnapshotBytes: number
  createdSnapshotCount: number
  plans: SandboxSnapshotPlan[]
  project: ProjectRef
  retentionUpdateCount: number
}

export interface VercelSandboxSnapshotCleanupResult {
  deletedSnapshotCount: number
  executed: boolean
  failures: CleanupFailure[]
  plan: VercelSandboxSnapshotCleanupPlan
  updatedRetentionCount: number
}

export interface VercelSandboxSnapshotCleanupSummary {
  candidateBytes: number
  candidateCount: number
  createdSnapshotBytes: number
  createdSnapshotCount: number
  deletedSnapshotCount: number
  executed: boolean
  failureCount: number
  failures: CleanupFailureSummary[]
  inspectedSandboxCount: number
  projectId: string
  retentionUpdateCount: number
  updatedRetentionCount: number
}

export function createVercelSandboxSnapshotCleanupClient(): SandboxSnapshotCleanupClient {
  return {
    async deleteSnapshot(input) {
      const handle = await Snapshot.get(
        withVercelSandboxCredentials({ snapshotId: input.snapshotId })
      )
      await handle.delete()
    },
    async listSandboxes(input) {
      const response = await Sandbox.list(
        withVercelSandboxCredentials({
          cursor: input.cursor,
          limit: input.limit,
        })
      )

      return {
        pagination: response.pagination,
        sandboxes: response.sandboxes,
      }
    },
    async listSnapshots(input) {
      const response = await Snapshot.list(
        withVercelSandboxCredentials({
          cursor: input.cursor,
          limit: input.limit,
          name: input.sandboxName,
        })
      )

      return {
        pagination: response.pagination,
        snapshots: response.snapshots,
      }
    },
    async updateSandboxRetention(input) {
      const handle = await Sandbox.get(
        withVercelSandboxCredentials({
          name: input.sandboxName,
          resume: false,
        })
      )
      await handle.update(PERSISTENT_SANDBOX_RETENTION_OPTIONS)
    },
  }
}

export function formatGb(bytes: number): string {
  return (bytes / BYTES_PER_GB).toFixed(3)
}

export function formatMonthlyUsd(bytes: number): string {
  return ((bytes / BYTES_PER_GB) * SANDBOX_STORAGE_USD_PER_GB_MONTH).toFixed(2)
}

export function summarizeVercelSandboxSnapshotCleanup(
  result: VercelSandboxSnapshotCleanupResult
): VercelSandboxSnapshotCleanupSummary {
  return {
    candidateBytes: result.plan.candidateBytes,
    candidateCount: result.plan.candidates.length,
    createdSnapshotBytes: result.plan.createdSnapshotBytes,
    createdSnapshotCount: result.plan.createdSnapshotCount,
    deletedSnapshotCount: result.deletedSnapshotCount,
    executed: result.executed,
    failureCount: result.failures.length,
    failures: result.failures.map((failure) => ({
      message: formatFailureMessage(failure.error),
      target: failure.target,
    })),
    inspectedSandboxCount: result.plan.plans.length,
    projectId: result.plan.project.id,
    retentionUpdateCount: result.plan.retentionUpdateCount,
    updatedRetentionCount: result.updatedRetentionCount,
  }
}

export async function sweepUnusedVercelSandboxSnapshots(
  options: VercelSandboxSnapshotCleanupOptions
): Promise<VercelSandboxSnapshotCleanupResult> {
  const plan = await buildVercelSandboxSnapshotCleanupPlan(options)
  if (!options.execute) {
    return {
      deletedSnapshotCount: 0,
      executed: false,
      failures: [],
      plan,
      updatedRetentionCount: 0,
    }
  }

  const execution = await applyCleanup({
    candidates: plan.candidates,
    client: options.client ?? createVercelSandboxSnapshotCleanupClient(),
    plans: plan.plans,
  })

  return {
    ...execution,
    executed: true,
    plan,
  }
}

export async function buildVercelSandboxSnapshotCleanupPlan(
  options: Omit<VercelSandboxSnapshotCleanupOptions, 'execute'>
): Promise<VercelSandboxSnapshotCleanupPlan> {
  const client = options.client ?? createVercelSandboxSnapshotCleanupClient()
  const project = resolveSandboxProject()
  const cutoffTimestamp =
    options.olderThanDays === null
      ? null
      : (options.now ?? Date.now()) - options.olderThanDays * DAY_IN_MS

  const sandboxes = await listSandboxes(client, project)
  const persistentSandboxes = selectPersistentSandboxes({
    sandboxName: options.sandboxName ?? null,
    sandboxes,
  })

  if (options.sandboxName && persistentSandboxes.length === 0) {
    throw new Error(
      `No persistent sandbox found with name ${options.sandboxName}.`
    )
  }

  const plans: SandboxSnapshotPlan[] = []
  for (const sandbox of persistentSandboxes) {
    plans.push(
      await buildSnapshotPlan({
        client,
        cutoffTimestamp,
        project,
        sandbox,
      })
    )
  }

  const candidates = flattenCandidates(plans).sort(compareCandidateSize)
  return {
    candidateBytes: sumCandidateBytes(candidates),
    candidates,
    createdSnapshotBytes: sumPlanCreatedSnapshotBytes(plans),
    createdSnapshotCount: sumPlanCreatedSnapshotCount(plans),
    plans,
    project,
    retentionUpdateCount: plans.filter((plan) => plan.needsRetentionUpdate)
      .length,
  }
}

function resolveSandboxProject(): ProjectRef {
  const credentials = getVercelSandboxCredentials()
  return {
    id: credentials.projectId,
    name: credentials.projectId,
  }
}

async function listSandboxes(
  client: SandboxSnapshotCleanupClient,
  project: ProjectRef
): Promise<SandboxRecord[]> {
  const sandboxes: SandboxRecord[] = []
  let cursor = ''
  const seenCursors = new Set<string>()

  do {
    if (cursor) {
      if (seenCursors.has(cursor)) {
        throw new Error(
          `Repeated pagination cursor while listing sandboxes for project ${project.id}.`
        )
      }
      seenCursors.add(cursor)
    }

    const response = await client.listSandboxes({
      cursor: cursor || undefined,
      limit: VERCEL_PAGE_LIMIT,
    })

    sandboxes.push(...response.sandboxes)
    cursor = response.pagination.next ?? ''
  } while (cursor)

  return sandboxes
}

async function listSnapshotsForSandbox(input: {
  client: SandboxSnapshotCleanupClient
  project: ProjectRef
  sandboxName: string
}): Promise<SnapshotRecord[]> {
  const snapshots: SnapshotRecord[] = []
  let cursor = ''
  const seenCursors = new Set<string>()

  do {
    if (cursor) {
      if (seenCursors.has(cursor)) {
        throw new Error(
          `Repeated pagination cursor while listing snapshots for sandbox ${input.sandboxName} in project ${input.project.id}.`
        )
      }
      seenCursors.add(cursor)
    }

    const response = await input.client.listSnapshots({
      cursor: cursor || undefined,
      limit: VERCEL_PAGE_LIMIT,
      sandboxName: input.sandboxName,
    })

    snapshots.push(...response.snapshots)
    cursor = response.pagination.next ?? ''
  } while (cursor)

  return snapshots
}

function selectPersistentSandboxes(input: {
  sandboxName: string | null
  sandboxes: readonly SandboxRecord[]
}): SandboxRecord[] {
  const persistentSandboxes = input.sandboxes.filter(
    (sandbox) => sandbox.persistent
  )
  if (!input.sandboxName) {
    return persistentSandboxes
  }

  return persistentSandboxes.filter(
    (sandbox) => sandbox.name === input.sandboxName
  )
}

async function buildSnapshotPlan(input: {
  client: SandboxSnapshotCleanupClient
  cutoffTimestamp: number | null
  project: ProjectRef
  sandbox: SandboxRecord
}): Promise<SandboxSnapshotPlan> {
  const snapshots = await listSnapshotsForSandbox({
    client: input.client,
    project: input.project,
    sandboxName: input.sandbox.name,
  })
  const createdSnapshots = snapshots.filter(
    (snapshot) => snapshot.status === 'created'
  )
  const candidates = selectCleanupCandidates({
    cutoffTimestamp: input.cutoffTimestamp,
    currentSnapshotId: input.sandbox.currentSnapshotId,
    sandboxName: input.sandbox.name,
    snapshots: createdSnapshots,
  })

  return {
    candidates,
    createdSnapshotBytes: sumSnapshotBytes(createdSnapshots),
    createdSnapshotCount: createdSnapshots.length,
    currentSnapshotId: input.sandbox.currentSnapshotId,
    needsRetentionUpdate: needsPersistentRetentionUpdate(input.sandbox),
    sandbox: input.sandbox,
  }
}

function selectCleanupCandidates(input: {
  cutoffTimestamp: number | null
  currentSnapshotId: string | undefined
  sandboxName: string
  snapshots: readonly SnapshotRecord[]
}): SnapshotCandidate[] {
  const candidates: SnapshotCandidate[] = []

  for (const snapshot of input.snapshots) {
    if (snapshot.id === input.currentSnapshotId) {
      continue
    }
    if (
      input.cutoffTimestamp !== null &&
      snapshot.createdAt >= input.cutoffTimestamp
    ) {
      continue
    }

    candidates.push({
      sandboxName: input.sandboxName,
      snapshot,
    })
  }

  return candidates.sort(compareCandidateSize)
}

function needsPersistentRetentionUpdate(sandbox: SandboxRecord): boolean {
  const keepLastSnapshots = sandbox.keepLastSnapshots
  return (
    sandbox.snapshotExpiration !==
      PERSISTENT_SANDBOX_RETENTION_OPTIONS.snapshotExpiration ||
    keepLastSnapshots?.count !==
      PERSISTENT_SANDBOX_RETENTION_OPTIONS.keepLastSnapshots.count ||
    keepLastSnapshots?.deleteEvicted !==
      PERSISTENT_SANDBOX_RETENTION_OPTIONS.keepLastSnapshots.deleteEvicted ||
    keepLastSnapshots?.expiration !== undefined
  )
}

function flattenCandidates(
  plans: readonly SandboxSnapshotPlan[]
): SnapshotCandidate[] {
  return plans.flatMap((plan) => plan.candidates)
}

function compareCandidateSize(
  leftCandidate: SnapshotCandidate,
  rightCandidate: SnapshotCandidate
): number {
  return rightCandidate.snapshot.sizeBytes - leftCandidate.snapshot.sizeBytes
}

function sumCandidateBytes(candidates: readonly SnapshotCandidate[]): number {
  let total = 0
  for (const candidate of candidates) {
    total += candidate.snapshot.sizeBytes
  }
  return total
}

function sumPlanCreatedSnapshotBytes(
  plans: readonly SandboxSnapshotPlan[]
): number {
  let total = 0
  for (const plan of plans) {
    total += plan.createdSnapshotBytes
  }
  return total
}

function sumPlanCreatedSnapshotCount(
  plans: readonly SandboxSnapshotPlan[]
): number {
  let total = 0
  for (const plan of plans) {
    total += plan.createdSnapshotCount
  }
  return total
}

function sumSnapshotBytes(snapshots: readonly SnapshotRecord[]): number {
  let total = 0
  for (const snapshot of snapshots) {
    total += snapshot.sizeBytes
  }
  return total
}

async function applyCleanup(input: {
  candidates: readonly SnapshotCandidate[]
  client: SandboxSnapshotCleanupClient
  plans: readonly SandboxSnapshotPlan[]
}): Promise<
  Pick<
    VercelSandboxSnapshotCleanupResult,
    'deletedSnapshotCount' | 'failures' | 'updatedRetentionCount'
  >
> {
  const failures: CleanupFailure[] = []
  let deletedSnapshotCount = 0
  let updatedRetentionCount = 0

  for (const plan of input.plans) {
    if (!plan.needsRetentionUpdate) {
      continue
    }

    try {
      await input.client.updateSandboxRetention({
        sandboxName: plan.sandbox.name,
      })
      updatedRetentionCount += 1
    } catch (error) {
      failures.push({
        error,
        target: `${plan.sandbox.name}: retention update`,
      })
    }
  }

  for (const candidate of input.candidates) {
    try {
      await input.client.deleteSnapshot({ snapshotId: candidate.snapshot.id })
      deletedSnapshotCount += 1
    } catch (error) {
      failures.push({
        error,
        target: `${candidate.sandboxName}: ${candidate.snapshot.id}`,
      })
    }
  }

  return {
    deletedSnapshotCount,
    failures,
    updatedRetentionCount,
  }
}

function formatFailureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
