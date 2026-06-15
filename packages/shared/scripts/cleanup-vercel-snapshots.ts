import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline/promises'
import { Sandbox, Snapshot } from '@vercel/sandbox'
import {
  getVercelSandboxCredentials,
  PERSISTENT_SANDBOX_RETENTION_OPTIONS,
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

interface SandboxSnapshotPlan {
  candidates: SnapshotCandidate[]
  createdSnapshotBytes: number
  createdSnapshotCount: number
  currentSnapshotId: string | undefined
  needsRetentionUpdate: boolean
  sandbox: ListedSandbox
}

interface ScriptOptions {
  execute: boolean
  help: boolean
  maxListed: number
  olderThanDays: number | null
  sandboxName: string | null
  yes: boolean
}

interface SnapshotCandidate {
  sandboxName: string
  snapshot: ListedSnapshot
}

type ListedSandbox = Awaited<
  ReturnType<typeof Sandbox.list>
>['sandboxes'][number]
type ListedSnapshot = Awaited<
  ReturnType<typeof Snapshot.list>
>['snapshots'][number]

function printUsage(): void {
  console.log(`Clean up non-current Vercel Sandbox snapshots for persistent sandboxes.

Usage:
  pnpm vercel:snapshots:cleanup [options]
  pnpm exec tsx packages/shared/scripts/cleanup-vercel-snapshots.ts [options]

Options:
  --sandbox-name <name>     Only inspect one persistent sandbox by name.
  --older-than-days <days>  Optional. Only delete non-current snapshots created
                            before this age threshold. By default, every
                            non-current created snapshot is a candidate.
  --max-listed <count>      Number of candidate snapshots to print in the
                            dry-run summary. Default: ${DEFAULT_MAX_LISTED_CANDIDATES}.
  --execute                 Apply retention updates and delete candidate
                            snapshots. Without this flag the script only
                            prints a dry-run plan.
  --yes                     Skip the interactive confirmation prompt.
  --help                    Show this help text.

Safety:
  - Only persistent sandboxes are inspected.
  - Snapshots are listed with Snapshot.list({ name: sandbox.name }).
  - The sandbox currentSnapshotId is always protected.
  - Only snapshots with status "created" are delete candidates.
  - Existing persistent sandboxes are updated to keepLastSnapshots count=1.

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
    sandboxName: null,
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
      case '--sandbox-name':
        options.sandboxName = readStringArgument({
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

function readStringArgument(input: {
  argument: string
  value: string | undefined
}): string {
  if (!input.value?.trim()) {
    throw new Error(`Missing value for ${input.argument}.`)
  }

  return input.value.trim()
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

async function listSnapshotsForSandbox(input: {
  project: ProjectRef
  sandboxName: string
}): Promise<ListedSnapshot[]> {
  const snapshots: ListedSnapshot[] = []
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

    const response = await Snapshot.list(
      withVercelSandboxCredentials({
        cursor: cursor || undefined,
        limit: VERCEL_PAGE_LIMIT,
        name: input.sandboxName,
      })
    )

    snapshots.push(...response.snapshots)
    cursor = response.pagination.next ?? ''
  } while (cursor)

  return snapshots
}

function selectPersistentSandboxes(input: {
  sandboxName: string | null
  sandboxes: readonly ListedSandbox[]
}): ListedSandbox[] {
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
  cutoffTimestamp: number | null
  project: ProjectRef
  sandbox: ListedSandbox
}): Promise<SandboxSnapshotPlan> {
  const snapshots = await listSnapshotsForSandbox({
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
  snapshots: readonly ListedSnapshot[]
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

  return candidates.sort(
    (leftCandidate, rightCandidate) =>
      rightCandidate.snapshot.sizeBytes - leftCandidate.snapshot.sizeBytes
  )
}

function needsPersistentRetentionUpdate(sandbox: ListedSandbox): boolean {
  const keepLastSnapshots = sandbox.keepLastSnapshots
  return (
    sandbox.snapshotExpiration !==
      PERSISTENT_SANDBOX_RETENTION_OPTIONS.snapshotExpiration ||
    keepLastSnapshots?.count !==
      PERSISTENT_SANDBOX_RETENTION_OPTIONS.keepLastSnapshots.count ||
    keepLastSnapshots.deleteEvicted !==
      PERSISTENT_SANDBOX_RETENTION_OPTIONS.keepLastSnapshots.deleteEvicted ||
    keepLastSnapshots.expiration !== undefined
  )
}

function flattenCandidates(
  plans: readonly SandboxSnapshotPlan[]
): SnapshotCandidate[] {
  return plans.flatMap((plan) => plan.candidates)
}

function sumCandidateBytes(candidates: readonly SnapshotCandidate[]): number {
  let total = 0
  for (const candidate of candidates) {
    total += candidate.snapshot.sizeBytes
  }
  return total
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
  candidates: readonly SnapshotCandidate[]
  maxListed: number
  plans: readonly SandboxSnapshotPlan[]
  project: ProjectRef
}): void {
  const createdSnapshotBytes = input.plans.reduce(
    (total, plan) => total + plan.createdSnapshotBytes,
    0
  )
  const createdSnapshotCount = input.plans.reduce(
    (total, plan) => total + plan.createdSnapshotCount,
    0
  )
  const candidateBytes = sumCandidateBytes(input.candidates)
  const retentionUpdateCount = input.plans.filter(
    (plan) => plan.needsRetentionUpdate
  ).length

  console.log(
    `Found ${input.plans.length} persistent sandbox(es) in ${input.project.name} (${input.project.id}).`
  )
  console.log(
    `Created snapshots on inspected persistent sandboxes: ${createdSnapshotCount} (${formatGb(createdSnapshotBytes)} GB, about $${formatMonthlyUsd(createdSnapshotBytes)}/month at $${SANDBOX_STORAGE_USD_PER_GB_MONTH}/GB-month).`
  )
  console.log(`Retention updates needed: ${retentionUpdateCount}.`)
  console.log(
    `Delete candidates: ${input.candidates.length} (${formatGb(candidateBytes)} GB, about $${formatMonthlyUsd(candidateBytes)}/month).`
  )

  if (input.plans.length > 0) {
    console.log('\nPersistent sandboxes')
  }
  for (const plan of input.plans) {
    const planBytes = sumCandidateBytes(plan.candidates)
    console.log(
      [
        `  - ${plan.sandbox.name}`,
        `status=${plan.sandbox.status}`,
        `current=${plan.currentSnapshotId ?? '-'}`,
        `created=${plan.createdSnapshotCount}`,
        `delete=${plan.candidates.length}`,
        `deleteGb=${formatGb(planBytes)}`,
        `retention=${plan.needsRetentionUpdate ? 'update' : 'ok'}`,
      ].join(' | ')
    )
  }

  if (input.candidates.length === 0) {
    return
  }

  console.log('\nLargest delete candidates')
  for (const candidate of input.candidates.slice(0, input.maxListed)) {
    const { snapshot } = candidate
    console.log(
      [
        `  - ${snapshot.id}`,
        `sandbox=${candidate.sandboxName}`,
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
  candidates: readonly SnapshotCandidate[]
): Promise<boolean> {
  if (!options.execute) {
    console.log(
      '\nDry run only. Re-run with --execute to update retention and delete candidates.'
    )
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

async function updateSandboxRetention(sandbox: ListedSandbox): Promise<void> {
  const handle = await Sandbox.get(
    withVercelSandboxCredentials({
      name: sandbox.name,
      resume: false,
    })
  )
  await handle.update(PERSISTENT_SANDBOX_RETENTION_OPTIONS)
}

async function deleteSnapshot(candidate: SnapshotCandidate): Promise<void> {
  const handle = await Snapshot.get(
    withVercelSandboxCredentials({ snapshotId: candidate.snapshot.id })
  )
  await handle.delete()
}

async function applyCleanup(
  plans: readonly SandboxSnapshotPlan[],
  candidates: readonly SnapshotCandidate[]
): Promise<CleanupFailure[]> {
  const failures: CleanupFailure[] = []

  for (const plan of plans) {
    if (!plan.needsRetentionUpdate) {
      continue
    }
    try {
      await updateSandboxRetention(plan.sandbox)
      console.log(`[retention updated] ${plan.sandbox.name}`)
    } catch (error) {
      failures.push({
        error,
        target: `${plan.sandbox.name}: retention update`,
      })
    }
  }

  for (const candidate of candidates) {
    try {
      await deleteSnapshot(candidate)
      console.log(
        `[deleted] ${candidate.snapshot.id} (${candidate.sandboxName}, ${formatGb(candidate.snapshot.sizeBytes)} GB)`
      )
    } catch (error) {
      console.log(`[failed to delete] ${candidate.snapshot.id} (${candidate.sandboxName}, ${formatGb(candidate.snapshot.sizeBytes)} GB): ${error}`)
      failures.push({
        error,
        target: `${candidate.sandboxName}: ${candidate.snapshot.id}`,
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

  const project = resolveSandboxProject(getVercelSandboxCredentials())
  const cutoffTimestamp =
    options.olderThanDays === null
      ? null
      : Date.now() - options.olderThanDays * 24 * 60 * 60_000

  console.log(
    `Scanning persistent Vercel Sandbox snapshots for ${project.name} (${project.id}).`
  )

  const sandboxes = await listSandboxes(project)
  const persistentSandboxes = selectPersistentSandboxes({
    sandboxName: options.sandboxName,
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
        cutoffTimestamp,
        project,
        sandbox,
      })
    )
  }
  const candidates = flattenCandidates(plans).sort(
    (leftCandidate, rightCandidate) =>
      rightCandidate.snapshot.sizeBytes - leftCandidate.snapshot.sizeBytes
  )

  printPlan({
    candidates,
    maxListed: options.maxListed,
    plans,
    project,
  })

  if (candidates.length === 0) {
    console.log('\nNo snapshot delete candidates found.')
  }

  const retentionUpdateCount = plans.filter(
    (plan) => plan.needsRetentionUpdate
  ).length
  if (candidates.length === 0 && retentionUpdateCount === 0) {
    console.log('Nothing to do.')
    return
  }

  const shouldExecute = await ensureExecutionAllowed(options, candidates)
  if (!shouldExecute) {
    return
  }

  const failures = await applyCleanup(plans, candidates)
  if (failures.length > 0) {
    printFailures(failures)
    process.exitCode = 1
    return
  }

  console.log(
    `\nCleanup complete for ${candidates.length} snapshot(s) and ${retentionUpdateCount} retention update(s).`
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Failed: ${message}`)
  process.exitCode = 1
})
