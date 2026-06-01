import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline/promises'
import { Sandbox } from '@vercel/sandbox'
import {
  getVercelSandboxCredentials,
  type VercelSandboxCredentials,
  withVercelSandboxCredentials,
} from '../server/vercel-sandbox-config'
import { loadDotEnvFiles } from './load-dotenv-files'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const VERCEL_PAGE_LIMIT = 50

interface ScriptOptions {
  execute: boolean
  help: boolean
  yes: boolean
}

interface ProjectRef {
  id: string
  name: string
}

interface CleanupFailure {
  error: unknown
  target: string
}

type ListedSandbox = Awaited<
  ReturnType<typeof Sandbox.list>
>['sandboxes'][number]

function printUsage(): void {
  console.log(`Destroy non-persistent Vercel sandboxes for the current Vercel project.

Usage:
  pnpm vercel:sandboxes:destroy-all [options]
  pnpm exec tsx packages/shared/scripts/destroy-vercel-sandboxes.ts [options]

Options:
  --execute               Actually delete the sandboxes. Without this flag the
                          script only prints a dry-run plan.
  --yes                   Skip the interactive confirmation prompt.
  --help                  Show this help text.

Notes:
  Persistent sandboxes are listed for visibility but are never deleted.

Environment:
  SANDOX_TEAM_ID           Vercel team id for Sandbox API calls.
  SANDBOX_PROJECT_ID       Vercel project id for Sandbox API calls.
  SANDBOX_ACCESS_TOKEN     Vercel access token for Sandbox API calls.

  Values are loaded from .env.local and .env files under the repo root,
  including app and package directories. Root env files take precedence.

Examples:
  pnpm vercel:sandboxes:destroy-all
  pnpm vercel:sandboxes:destroy-all --execute
`)
}

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    execute: false,
    yes: false,
    help: false,
  }

  for (const arg of argv) {
    switch (arg) {
      case '--execute':
        options.execute = true
        break
      case '--yes':
        options.yes = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
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
        limit: VERCEL_PAGE_LIMIT,
        cursor: cursor || undefined,
      })
    )

    sandboxes.push(...response.sandboxes)
    cursor = response.pagination.next ?? ''
  } while (cursor)

  return sandboxes
}

function selectNonPersistentSandboxes(
  sandboxes: readonly ListedSandbox[]
): ListedSandbox[] {
  return sandboxes.filter((sandbox) => !sandbox.persistent)
}

function printPlan(
  project: ProjectRef,
  sandboxes: readonly ListedSandbox[],
  skippedPersistentCount: number
): void {
  console.log(
    `Found ${sandboxes.length} non-persistent named sandbox(es) to delete in ${project.name} (${project.id}).`
  )
  if (skippedPersistentCount > 0) {
    console.log(`Skipping ${skippedPersistentCount} persistent sandbox(es).`)
  }

  if (sandboxes.length === 0) {
    return
  }

  console.log('\nNon-persistent sandboxes')
  for (const sandbox of sandboxes) {
    console.log(`  - ${sandbox.name} [${sandbox.status}]`)
  }
}

async function confirmExecution(count: number): Promise<boolean> {
  const prompt = `Type DESTROY ${count} to continue: `
  const expectedAnswer = `DESTROY ${count}`

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
  sandboxes: readonly ListedSandbox[]
): Promise<boolean> {
  if (!options.execute) {
    console.log('\nDry run only. Re-run with --execute to apply the cleanup.')
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

  const confirmed = await confirmExecution(sandboxes.length)
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

async function deleteSandbox(input: { sandbox: ListedSandbox }): Promise<void> {
  const sandbox = await Sandbox.get(
    withVercelSandboxCredentials({
      name: input.sandbox.name,
      resume: false,
    })
  )
  await sandbox.delete()
}

async function applyCleanup(
  project: ProjectRef,
  sandboxes: readonly ListedSandbox[]
): Promise<CleanupFailure[]> {
  const failures: CleanupFailure[] = []

  for (const sandbox of sandboxes) {
    try {
      await deleteSandbox({ sandbox })
      console.log(`[deleted] ${sandbox.name} (${project.id})`)
    } catch (error) {
      failures.push({
        target: `${project.name}: ${sandbox.name}`,
        error,
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

  console.log(
    `Scanning current Vercel project for non-persistent sandboxes: ${project.name} (${project.id})`
  )

  const listedSandboxes = await listSandboxes(project)
  const sandboxes = selectNonPersistentSandboxes(listedSandboxes)
  const skippedPersistentCount = listedSandboxes.length - sandboxes.length
  printPlan(project, sandboxes, skippedPersistentCount)

  if (sandboxes.length === 0) {
    console.log('\nNothing to do.')
    return
  }

  const shouldExecute = await ensureExecutionAllowed(options, sandboxes)
  if (!shouldExecute) {
    return
  }

  const failures = await applyCleanup(project, sandboxes)
  if (failures.length > 0) {
    printFailures(failures)
    process.exitCode = 1
    return
  }

  console.log(
    `\nCleanup complete for ${sandboxes.length} non-persistent named sandbox(es).`
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Failed: ${message}`)
  process.exitCode = 1
})
