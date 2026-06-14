import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline/promises'
import { Sandbox, Snapshot } from '@vercel/sandbox'
import {
  getVercelSandboxCredentials,
  type VercelSandboxCredentials,
  withVercelSandboxCredentials,
} from '../server/vercel-sandbox-config'
import { loadDotEnvFiles } from './load-dotenv-files'

const BYTES_PER_GB = 1_000_000_000
const DEFAULT_MAX_LISTED_CANDIDATES = 50
const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const SANDBOX_STORAGE_USD_PER_GB_MONTH = 0.08
const VERCEL_PAGE_LIMIT = 50

interface CleanupFailure {
  error: unknown
  target: string
}

interface ProjectRef {
  id: string
  name: string
}

interface ScriptOptions {
  execute: boolean
  help: boolean
  maxListed: number
  olderThanDays: number | null
  yes: boolean
}

type ListedSandbox = Awaited<
  ReturnType<typeof Sandbox.list>
>['sandboxes'][number]
type ListedSnapshot = Awaited<
  ReturnType<typeof Snapshot.list>
>['snapshots'][number]

function printUsage(): void {
  console.log(`Clean up old Vercel Sandbox snapshots for the current project.

Usage:
  pnpm vercel:snapshots:cleanup --older-than-days 14 [options]
  pnpm exec tsx packages/shared/scripts/cleanup-vercel-snapshots.ts --older-than-days 14 [options]

Options:
  --older-than-days <days>  Required. Only consider snapshots created before
                            this age threshold.
  --max-listed <count>      Number of candidate snapshots to print in the
                            dry-run summary. Default: ${DEFAULT_MAX_LISTED_CANDIDATES}.
  --execute                 Actually delete candidate snapshots. Without this
                            flag the script only prints a dry-run plan.
  --yes                     Skip the interactive confirmation prompt.
  --help                    Show this help text.

Safety:
  - Only snapshots with status "created" are candidates.
  - Current snapshots for listed sandboxes are protected.
  - Ancestors of protected snapshots are protected through parentId.
  - Snapshots used more recently than the age threshold are protected.

Environment:
  SANDBOX_TEAM_ID           Vercel team id for Sandbox API calls.
  SANDBOX_PROJECT_ID        Vercel project id for Sandbox API calls.
  SANDBOX_ACCESS_TOKEN      Vercel access token for Sandbox API calls.

  Values are loaded from .env.local and .env files under the repo root,
  including app and package directories. Root env files take precedence.
`)
}

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    execute: false,
    help: false,
    maxListed: DEFAULT_MAX_LISTED_CANDIDATES,
    olderThanDays: null,
    yes: false,
  }

  let index = 0
  while (index < argv.length) {
    const arg = argv[index]
    switch (arg) {
      case '--execute':
        options.execute = true
        index += 1
        break
      case '--help':
      case '-h':
        options.help = true
        index += 1
        break
      case '--max-listed':
        options.maxListed = readPositiveIntegerArgument({
          argument: arg,
          value: argv[index + 1],
        })
        index += 2
        break
      case '--older-than-days':
        options.olderThanDays = readPositiveIntegerArgument({
          argument: arg,
          value: argv[index + 1],
        })
        index += 2
        break
      case '--yes':
        options.yes = true
        index += 1
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function readPositiveIntegerArgument(input: {
  argument: string
  value: string | undefined
}): number {
  if (!input.value) {
    throw new Error(`Missing value for ${input.argument}.`)
  }

  const parsedValue = Number(input.value)
  if (!(Number.isInteger(parsedValue) && parsedValue > 0)) {
    throw new Error(`${input.argument} must be a positive integer.`)
  }

  return parsedValue
}

function resolveSandboxProject(
  credentials: VercelSandboxCredentials
): ProjectRef {
  return {
    id: credentials.projectId,
    name: credentials.projectId,
  }
}

async function listSandboxes(project: ProjectRef): Promise<ListedSandbox[]> {
  const sandboxes: ListedSandbox[] = []
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

    const response = await Sandbox.list(
      withVercelSandboxCredentials({
        cursor: cursor || undefined,
        limit: VERCEL_PAGE_LIMIT,
      })
    )

    sandboxes.push(...response.sandboxes)
    cursor = response.pagination.next ?? ''
  } while (cursor)

  return sandboxes
}

async function listSnapshots(project: ProjectRef): Promise<ListedSnapshot[]> {
  const snapshots: ListedSnapshot[] = []
  let cursor = ''
  const seenCursors = new Set<string>()

  do {
    if (cursor) {
      if (seenCursors.has(cursor)) {
        throw new Error(
          `Repeated pagination cursor while listing snapshots for project ${project.id}.`
        )
      }
      seenCursors.add(cursor)
    }

    const response = await Snapshot.list(
      withVercelSandboxCredentials({
        cursor: cursor || undefined,
        limit: VERCEL_PAGE_LIMIT,
      })
    )

    snapshots.push(...response.snapshots)
    cursor = response.pagination.next ?? ''
  } while (cursor)

  return snapshots
}

function collectProtectedSnapshotIds(input: {
  sandboxes: readonly ListedSandbox[]
  snapshots: readonly ListedSnapshot[]
}): Set<string> {
  const snapshotsById = new Map(
    input.snapshots.map((snapshot) => [snapshot.id, snapshot])
  )
  const protectedIds = new Set<string>()
  const protectedSessionIds = new Set<string>()

  for (const sandbox of input.sandboxes) {
    if (shouldProtectSandboxSnapshot(sandbox)) {
      protectSnapshotWithAncestors({
        protectedIds,
        snapshotId: sandbox.currentSnapshotId,
        snapshotsById,
      })
      if (sandbox.currentSessionId) {
        protectedSessionIds.add(sandbox.currentSessionId)
      }
    }
  }

  for (const snapshot of input.snapshots) {
    if (protectedSessionIds.has(snapshot.sourceSessionId)) {
      protectSnapshotWithAncestors({
        protectedIds,
        snapshotId: snapshot.id,
        snapshotsById,
      })
    }
  }

  return protectedIds
}

function shouldProtectSandboxSnapshot(sandbox: ListedSandbox): boolean {
  return (
    sandbox.persistent ||
    sandbox.status === 'pending' ||
    sandbox.status === 'running' ||
    sandbox.status === 'snapshotting' ||
    sandbox.status === 'stopping'
  )
}

function protectSnapshotWithAncestors(input: {
  protectedIds: Set<string>
  snapshotId: string | undefined
  snapshotsById: ReadonlyMap<string, ListedSnapshot>
}): void {
  let snapshotId = input.snapshotId
  while (snapshotId) {
    if (input.protectedIds.has(snapshotId)) {
      return
    }
    input.protectedIds.add(snapshotId)
    snapshotId = input.snapshotsById.get(snapshotId)?.parentId
  }
}

function selectCleanupCandidates(input: {
  cutoffTimestamp: number
  protectedIds: ReadonlySet<string>
  snapshots: readonly ListedSnapshot[]
}): ListedSnapshot[] {
  const candidates: ListedSnapshot[] = []

  for (const snapshot of input.snapshots) {
    if (snapshot.status !== 'created') {
      continue
    }
    if (input.protectedIds.has(snapshot.id)) {
      continue
    }
    if (snapshot.createdAt >= input.cutoffTimestamp) {
      continue
    }
    if (
      snapshot.lastUsedAt !== undefined &&
      snapshot.lastUsedAt >= input.cutoffTimestamp
    ) {
      continue
    }

    candidates.push(snapshot)
  }

  return candidates.sort(
    (leftSnapshot, rightSnapshot) =>
      rightSnapshot.sizeBytes - leftSnapshot.sizeBytes
  )
}

function sumSnapshotBytes(snapshots: readonly ListedSnapshot[]): number {
  let total = 0
  for (const snapshot of snapshots) {
    total += snapshot.sizeBytes
  }
  return total
}

function formatDate(timestamp: number | undefined): string {
  if (timestamp === undefined) {
    return '-'
  }

  return new Date(timestamp).toISOString()
}

function formatGb(bytes: number): string {
  return (bytes / BYTES_PER_GB).toFixed(3)
}

function formatMonthlyUsd(bytes: number): string {
  return ((bytes / BYTES_PER_GB) * SANDBOX_STORAGE_USD_PER_GB_MONTH).toFixed(2)
}

function printPlan(input: {
  candidates: readonly ListedSnapshot[]
  createdSnapshots: readonly ListedSnapshot[]
  maxListed: number
  project: ProjectRef
  protectedIds: ReadonlySet<string>
  snapshots: readonly ListedSnapshot[]
}): void {
  const candidateBytes = sumSnapshotBytes(input.candidates)
  const createdBytes = sumSnapshotBytes(input.createdSnapshots)

  console.log(
    `Found ${input.snapshots.length} snapshot(s) in ${input.project.name} (${input.project.id}).`
  )
  console.log(
    `Created snapshots: ${input.createdSnapshots.length} (${formatGb(createdBytes)} GB, about $${formatMonthlyUsd(createdBytes)}/month at $${SANDBOX_STORAGE_USD_PER_GB_MONTH}/GB-month).`
  )
  console.log(`Protected snapshots: ${input.protectedIds.size}.`)
  console.log(
    `Cleanup candidates: ${input.candidates.length} (${formatGb(candidateBytes)} GB, about $${formatMonthlyUsd(candidateBytes)}/month).`
  )

  if (input.candidates.length === 0) {
    return
  }

  console.log('\nLargest cleanup candidates')
  for (const snapshot of input.candidates.slice(0, input.maxListed)) {
    console.log(
      [
        `  - ${snapshot.id}`,
        `${formatGb(snapshot.sizeBytes)} GB`,
        `created=${formatDate(snapshot.createdAt)}`,
        `lastUsed=${formatDate(snapshot.lastUsedAt)}`,
        `expires=${formatDate(snapshot.expiresAt)}`,
        `sourceSession=${snapshot.sourceSessionId}`,
        `parent=${snapshot.parentId ?? '-'}`,
      ].join(' | ')
    )
  }

  if (input.candidates.length > input.maxListed) {
    console.log(
      `  ... ${input.candidates.length - input.maxListed} more candidate(s). Use --max-listed ${input.candidates.length} to print all.`
    )
  }
}

async function confirmExecution(count: number): Promise<boolean> {
  const prompt = `Type DELETE SNAPSHOTS ${count} to continue: `
  const expectedAnswer = `DELETE SNAPSHOTS ${count}`

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question(prompt)
    return answer.trim() === expectedAnswer
  } finally {
    rl.close()
  }
}

async function ensureExecutionAllowed(
  options: ScriptOptions,
  candidates: readonly ListedSnapshot[]
): Promise<boolean> {
  if (!options.execute) {
    console.log('\nDry run only. Re-run with --execute to delete candidates.')
    return false
  }

  if (options.yes) {
    return true
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      'Interactive confirmation requires a TTY. Re-run with --yes.'
    )
  }

  const confirmed = await confirmExecution(candidates.length)
  if (confirmed) {
    return true
  }

  console.log('Confirmation did not match. Aborting.')
  process.exitCode = 1
  return false
}

function printFailures(failures: readonly CleanupFailure[]): void {
  console.error('\nCompleted with failures:')
  for (const failure of failures) {
    const message =
      failure.error instanceof Error
        ? failure.error.message
        : String(failure.error)
    console.error(`  - ${failure.target}: ${message}`)
  }
}

async function deleteSnapshot(snapshot: ListedSnapshot): Promise<void> {
  const handle = await Snapshot.get(
    withVercelSandboxCredentials({ snapshotId: snapshot.id })
  )
  await handle.delete()
}

async function applyCleanup(
  snapshots: readonly ListedSnapshot[]
): Promise<CleanupFailure[]> {
  const failures: CleanupFailure[] = []

  for (const snapshot of snapshots) {
    try {
      await deleteSnapshot(snapshot)
      console.log(
        `[deleted] ${snapshot.id} (${formatGb(snapshot.sizeBytes)} GB)`
      )
    } catch (error) {
      failures.push({
        error,
        target: snapshot.id,
      })
    }
  }

  return failures
}

async function main(): Promise<void> {
  loadDotEnvFiles(REPO_ROOT)

  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }

  if (options.olderThanDays === null) {
    throw new Error('Missing required option: --older-than-days <days>.')
  }

  const project = resolveSandboxProject(getVercelSandboxCredentials())
  const cutoffTimestamp = Date.now() - options.olderThanDays * 24 * 60 * 60_000

  console.log(
    `Scanning Vercel Sandbox snapshots older than ${options.olderThanDays} day(s) for ${project.name} (${project.id}).`
  )

  const [sandboxes, snapshots] = await Promise.all([
    listSandboxes(project),
    listSnapshots(project),
  ])
  const protectedIds = collectProtectedSnapshotIds({ sandboxes, snapshots })
  const createdSnapshots = snapshots.filter(
    (snapshot) => snapshot.status === 'created'
  )
  const candidates = selectCleanupCandidates({
    cutoffTimestamp,
    protectedIds,
    snapshots,
  })

  printPlan({
    candidates,
    createdSnapshots,
    maxListed: options.maxListed,
    project,
    protectedIds,
    snapshots,
  })

  if (candidates.length === 0) {
    console.log('\nNothing to do.')
    return
  }

  const shouldExecute = await ensureExecutionAllowed(options, candidates)
  if (!shouldExecute) {
    return
  }

  const failures = await applyCleanup(candidates)
  if (failures.length > 0) {
    printFailures(failures)
    process.exitCode = 1
    return
  }

  console.log(`\nCleanup complete for ${candidates.length} snapshot(s).`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Failed: ${message}`)
  process.exitCode = 1
})
