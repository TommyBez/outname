import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline/promises'
import { Sandbox } from '@vercel/sandbox'

const VERCEL_PAGE_LIMIT = 50
const ENV_LINE_SPLITTER = /\r?\n/u

interface ParsedEnvLine {
  key: string
  value: string
}

interface ScriptOptions {
  execute: boolean
  help: boolean
  project: string
  teamId: string
  yes: boolean
}

interface ProjectRef {
  id: string
  name: string
  teamId: string
}

interface LinkedProjectFile {
  orgId?: unknown
  projectId?: unknown
  projectName?: unknown
}

interface VercelContext {
  teamId: string
  token: string
}

interface CleanupFailure {
  error: unknown
  target: string
}

type ListedSandbox = Awaited<
  ReturnType<typeof Sandbox.list>
>['sandboxes'][number]

function printUsage(): void {
  console.log(`Destroy Vercel sandboxes for the current Vercel project.

Usage:
  pnpm vercel:sandboxes:destroy-all [options]
  pnpm exec tsx scripts/destroy-vercel-sandboxes.ts [options]

Options:
  --execute               Actually delete the sandboxes. Without this flag the
                          script only prints a dry-run plan.
  --yes                   Skip the interactive confirmation prompt.
  --project <id-or-name>  Fallback project id/name when .vercel/project.json
                          and VERCEL_PROJECT_ID are unavailable.
  --team-id <team_id>     Optional Vercel team id for the project.
  --help                  Show this help text.

Environment:
  VERCEL_TOKEN            Preferred auth token.
  VERCEL_ACCESS_TOKEN     Fallback auth token.
  VERCEL_OIDC_TOKEN       Final fallback.
  VERCEL_PROJECT_ID       Fallback current project id.
  VERCEL_TEAM_ID          Optional default for --team-id.

Examples:
  VERCEL_TOKEN=... pnpm vercel:sandboxes:destroy-all
  VERCEL_TOKEN=... pnpm vercel:sandboxes:destroy-all --project prj_...
  VERCEL_TOKEN=... pnpm vercel:sandboxes:destroy-all --execute
`)
}

function loadDotEnvFiles(): void {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.join(process.cwd(), fileName)
    if (!fs.existsSync(filePath)) {
      continue
    }

    const content = fs.readFileSync(filePath, 'utf8')
    for (const rawLine of content.split(ENV_LINE_SPLITTER)) {
      const parsedEntry = parseEnvLine(rawLine)
      if (!parsedEntry || process.env[parsedEntry.key] !== undefined) {
        continue
      }

      process.env[parsedEntry.key] = parsedEntry.value
    }
  }
}

function parseEnvLine(rawLine: string): ParsedEnvLine | null {
  const line = rawLine.trim()
  if (!line || line.startsWith('#')) {
    return null
  }

  const normalized = line.startsWith('export ')
    ? line.slice('export '.length)
    : line
  const separatorIndex = normalized.indexOf('=')
  if (separatorIndex === -1) {
    return null
  }

  const key = normalized.slice(0, separatorIndex).trim()
  if (!key) {
    return null
  }

  let value = normalized.slice(separatorIndex + 1).trim()
  const isWrappedInDoubleQuotes = value.startsWith('"') && value.endsWith('"')
  const isWrappedInSingleQuotes = value.startsWith("'") && value.endsWith("'")

  if (isWrappedInDoubleQuotes || isWrappedInSingleQuotes) {
    value = value.slice(1, -1)
  }

  return { key, value }
}

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    execute: false,
    yes: false,
    help: false,
    project: '',
    teamId: process.env.VERCEL_TEAM_ID ?? '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

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
      case '--project':
        options.project = argv[index + 1] ?? ''
        index += 1
        break
      case '--team-id':
        options.teamId = argv[index + 1] ?? ''
        index += 1
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function readLinkedProject(): ProjectRef | null {
  const filePath = path.join(process.cwd(), '.vercel', 'project.json')
  if (!fs.existsSync(filePath)) {
    return null
  }

  const parsed = JSON.parse(
    fs.readFileSync(filePath, 'utf8')
  ) as LinkedProjectFile
  if (typeof parsed.projectId !== 'string' || parsed.projectId.length === 0) {
    throw new Error(
      '.vercel/project.json is missing projectId. Run `vercel link` again or pass --project.'
    )
  }

  return {
    id: parsed.projectId,
    name:
      typeof parsed.projectName === 'string' && parsed.projectName.length > 0
        ? parsed.projectName
        : parsed.projectId,
    teamId: typeof parsed.orgId === 'string' ? parsed.orgId : '',
  }
}

function resolveCurrentProject(options: ScriptOptions): ProjectRef {
  const linked = readLinkedProject()
  if (linked) {
    return {
      ...linked,
      teamId: options.teamId || linked.teamId,
    }
  }

  const envProjectId = process.env.VERCEL_PROJECT_ID
  if (envProjectId) {
    return { id: envProjectId, name: envProjectId, teamId: options.teamId }
  }

  if (options.project) {
    return {
      id: options.project,
      name: options.project,
      teamId: options.teamId,
    }
  }

  throw new Error(
    'No Vercel project resolved. Run `vercel link`, set VERCEL_PROJECT_ID, or pass --project.'
  )
}

function assertProjectScope(project: ProjectRef): void {
  if (project.teamId) {
    return
  }

  throw new Error(
    'No Vercel team resolved for the current project. Run `vercel link`, set VERCEL_TEAM_ID, or pass --team-id.'
  )
}

function resolveToken(): string {
  const token =
    process.env.VERCEL_TOKEN ??
    process.env.VERCEL_ACCESS_TOKEN ??
    process.env.VERCEL_OIDC_TOKEN

  if (!token) {
    throw new Error(
      'Missing VERCEL_TOKEN (or VERCEL_ACCESS_TOKEN / VERCEL_OIDC_TOKEN).'
    )
  }

  if (!process.env.VERCEL_TOKEN && process.env.VERCEL_OIDC_TOKEN) {
    console.warn(
      'Using VERCEL_OIDC_TOKEN. If cleanup fails, retry with VERCEL_TOKEN.'
    )
  }

  return token
}

async function listSandboxes(
  project: ProjectRef,
  context: VercelContext
): Promise<ListedSandbox[]> {
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

    const response = await Sandbox.list({
      projectId: project.id,
      token: context.token,
      teamId: context.teamId,
      limit: VERCEL_PAGE_LIMIT,
      cursor: cursor || undefined,
    })

    sandboxes.push(...response.sandboxes)
    cursor = response.pagination.next ?? ''
  } while (cursor)

  return sandboxes
}

function printPlan(
  project: ProjectRef,
  sandboxes: readonly ListedSandbox[]
): void {
  console.log(
    `Found ${sandboxes.length} named sandboxes to delete in ${project.name} (${project.id}).`
  )

  if (sandboxes.length === 0) {
    return
  }

  console.log('\nNamed sandboxes')
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

async function deleteSandbox(input: {
  context: VercelContext
  project: ProjectRef
  sandbox: ListedSandbox
}): Promise<void> {
  const sandbox = await Sandbox.get({
    name: input.sandbox.name,
    projectId: input.project.id,
    resume: false,
    teamId: input.context.teamId,
    token: input.context.token,
  })
  await sandbox.delete()
}

async function applyCleanup(
  project: ProjectRef,
  sandboxes: readonly ListedSandbox[],
  context: VercelContext
): Promise<CleanupFailure[]> {
  const failures: CleanupFailure[] = []

  for (const sandbox of sandboxes) {
    try {
      await deleteSandbox({ context, project, sandbox })
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
  loadDotEnvFiles()

  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }

  const project = resolveCurrentProject(options)
  assertProjectScope(project)
  const context: VercelContext = {
    token: resolveToken(),
    teamId: project.teamId,
  }

  console.log(
    `Scanning current Vercel project for sandboxes: ${project.name} (${project.id})`
  )

  const sandboxes = await listSandboxes(project, context)
  printPlan(project, sandboxes)

  if (sandboxes.length === 0) {
    console.log('\nNothing to do.')
    return
  }

  const shouldExecute = await ensureExecutionAllowed(options, sandboxes)
  if (!shouldExecute) {
    return
  }

  const failures = await applyCleanup(project, sandboxes, context)
  if (failures.length > 0) {
    printFailures(failures)
    process.exitCode = 1
    return
  }

  console.log(`\nCleanup complete for ${sandboxes.length} named sandboxes.`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Failed: ${message}`)
  process.exitCode = 1
})
