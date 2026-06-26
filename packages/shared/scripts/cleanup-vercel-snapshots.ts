import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline/promises'
import {
  formatGb,
  formatMonthlyUsd,
  SANDBOX_STORAGE_USD_PER_GB_MONTH,
  type SnapshotCandidate,
  summarizeVercelSandboxSnapshotCleanup,
  sweepUnusedVercelSandboxSnapshots,
  type VercelSandboxSnapshotCleanupPlan,
} from '../server/vercel-sandbox-snapshot-cleanup'
import { loadDotEnvFiles } from './load-dotenv-files'

const DEFAULT_MAX_LISTED_CANDIDATES = 50
const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')

interface ScriptOptions {
  execute: boolean
  help: boolean
  maxListed: number
  olderThanDays: number | null
  sandboxName: string | null
  yes: boolean
}

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

function formatDate(timestamp: number | undefined): string {
  if (timestamp === undefined) {
    return '-'
  }

  return new Date(timestamp).toISOString()
}

function printPlan(input: {
  maxListed: number
  plan: VercelSandboxSnapshotCleanupPlan
}): void {
  console.log(
    `Found ${input.plan.plans.length} persistent sandbox(es) in ${input.plan.project.name} (${input.plan.project.id}).`
  )
  console.log(
    `Created snapshots on inspected persistent sandboxes: ${input.plan.createdSnapshotCount} (${formatGb(input.plan.createdSnapshotBytes)} GB, about $${formatMonthlyUsd(input.plan.createdSnapshotBytes)}/month at $${SANDBOX_STORAGE_USD_PER_GB_MONTH}/GB-month).`
  )
  console.log(`Retention updates needed: ${input.plan.retentionUpdateCount}.`)
  console.log(
    `Delete candidates: ${input.plan.candidates.length} (${formatGb(input.plan.candidateBytes)} GB, about $${formatMonthlyUsd(input.plan.candidateBytes)}/month).`
  )

  if (input.plan.plans.length > 0) {
    console.log('\nPersistent sandboxes')
  }
  for (const plan of input.plan.plans) {
    const planBytes = sumCandidateBytes(plan.candidates)
    console.log(
      [
        `  - ${plan.sandbox.name}`,
        `status=${plan.sandbox.status ?? '-'}`,
        `current=${plan.currentSnapshotId ?? '-'}`,
        `created=${plan.createdSnapshotCount}`,
        `delete=${plan.candidates.length}`,
        `deleteGb=${formatGb(planBytes)}`,
        `retention=${plan.needsRetentionUpdate ? 'update' : 'ok'}`,
      ].join(' | ')
    )
  }

  if (input.plan.candidates.length === 0) {
    return
  }

  console.log('\nLargest delete candidates')
  for (const candidate of input.plan.candidates.slice(0, input.maxListed)) {
    const { snapshot } = candidate
    console.log(
      [
        `  - ${snapshot.id}`,
        `sandbox=${candidate.sandboxName}`,
        `${formatGb(snapshot.sizeBytes)} GB`,
        `created=${formatDate(snapshot.createdAt)}`,
        `lastUsed=${formatDate(snapshot.lastUsedAt)}`,
        `expires=${formatDate(snapshot.expiresAt)}`,
        `sourceSession=${snapshot.sourceSessionId ?? '-'}`,
        `parent=${snapshot.parentId ?? '-'}`,
      ].join(' | ')
    )
  }

  if (input.plan.candidates.length > input.maxListed) {
    console.log(
      `  ... ${input.plan.candidates.length - input.maxListed} more candidate(s). Use --max-listed ${input.plan.candidates.length} to print all.`
    )
  }
}

function sumCandidateBytes(candidates: readonly SnapshotCandidate[]): number {
  let total = 0
  for (const candidate of candidates) {
    total += candidate.snapshot.sizeBytes
  }
  return total
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
  candidateCount: number
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

  const confirmed = await confirmExecution(candidateCount)
  if (confirmed) {
    return true
  }

  console.log('Confirmation did not match. Aborting.')
  process.exitCode = 1
  return false
}

function printFailures(
  failures: ReturnType<typeof summarizeVercelSandboxSnapshotCleanup>['failures']
): void {
  console.error('\nCompleted with failures:')
  for (const failure of failures) {
    console.error(`  - ${failure.target}: ${failure.message}`)
  }
}

async function main(): Promise<void> {
  loadDotEnvFiles(REPO_ROOT)

  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }

  console.log('Scanning persistent Vercel Sandbox snapshots.')
  const dryRun = await sweepUnusedVercelSandboxSnapshots({
    execute: false,
    olderThanDays: options.olderThanDays,
    sandboxName: options.sandboxName,
  })

  printPlan({ maxListed: options.maxListed, plan: dryRun.plan })

  if (dryRun.plan.candidates.length === 0) {
    console.log('\nNo snapshot delete candidates found.')
  }

  if (
    dryRun.plan.candidates.length === 0 &&
    dryRun.plan.retentionUpdateCount === 0
  ) {
    console.log('Nothing to do.')
    return
  }

  const shouldExecute = await ensureExecutionAllowed(
    options,
    dryRun.plan.candidates.length
  )
  if (!shouldExecute) {
    return
  }

  const result = await sweepUnusedVercelSandboxSnapshots({
    execute: true,
    olderThanDays: options.olderThanDays,
    sandboxName: options.sandboxName,
  })
  const summary = summarizeVercelSandboxSnapshotCleanup(result)

  if (summary.failureCount > 0) {
    printFailures(summary.failures)
    process.exitCode = 1
    return
  }

  console.log(
    `\nCleanup complete for ${summary.deletedSnapshotCount} snapshot(s) and ${summary.updatedRetentionCount} retention update(s).`
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Failed: ${message}`)
  process.exitCode = 1
})
