import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline/promises'

const API_BASE_URL = 'https://api.vercel.com'
const VERCEL_PAGE_LIMIT = 50
const TERMINAL_SANDBOX_STATUSES = new Set(['aborted', 'stopped', 'stopping'])
const ENV_LINE_SPLITTER = /\r?\n/u

interface ParsedEnvLine {
  key: string
  value: string
}

interface ScriptOptions {
  execute: boolean
  help: boolean
  project: string
  slug: string
  teamId: string
  yes: boolean
}

interface VercelContext {
  slug: string
  teamId: string
  token: string
}

interface ProjectRef {
  id: string
  name: string
}

interface ProjectApiEntry {
  id?: string
  name?: string
  project?: {
    name?: string
  }
  projectId?: string
  uid?: string
}

interface ProjectListResponse {
  pagination?: {
    next?: string
  }
  projects?: ProjectApiEntry[]
}

interface NamedSandboxApiEntry {
  currentSessionId?: string
  name?: string
  status?: string
  [key: string]: unknown
}

interface NamedSandbox extends NamedSandboxApiEntry {
  name: string
  projectId: string
  projectName: string
}

interface NamedSandboxListResponse {
  pagination?: {
    next?: string
  }
  sandboxes?: NamedSandboxApiEntry[]
}

interface StandaloneSandboxApiEntry {
  id?: string
  status?: string
  [key: string]: unknown
}

interface StandaloneSandbox extends StandaloneSandboxApiEntry {
  id: string
  projectId: string
  projectName: string
}

interface StandaloneSandboxListResponse {
  pagination?: {
    next?: string
  }
  sandboxes?: StandaloneSandboxApiEntry[]
}

interface CleanupFailure {
  error: unknown
  target: string
}

interface JsonErrorBody {
  error?: {
    message?: string
    code?: string
  }
  message?: string
  raw?: string
}

function printUsage(): void {
  console.log(`Destroy Vercel sandboxes across a personal account or team.

Usage:
  pnpm vercel:sandboxes:destroy-all [options]
  pnpm exec tsx scripts/destroy-vercel-sandboxes.ts [options]

Options:
  --execute               Actually perform the deletions. Without this flag the
                          script only prints a dry-run plan.
  --yes                   Skip the interactive confirmation prompt.
  --project <id-or-name>  Only target one project instead of scanning them all.
  --team-id <team_id>     Run against a specific Vercel team.
  --slug <team-slug>      Run against a specific Vercel team slug.
  --help                  Show this help text.

Environment:
  VERCEL_TOKEN            Preferred auth token for account-wide cleanup.
  VERCEL_ACCESS_TOKEN     Fallback auth token.
  VERCEL_OIDC_TOKEN       Final fallback; can be too narrow for full account scans.
  VERCEL_TEAM_ID          Optional default for --team-id.
  VERCEL_TEAM_SLUG        Optional default for --slug.
  VERCEL_SCOPE            Optional default for --slug.

Examples:
  VERCEL_TOKEN=... pnpm vercel:sandboxes:destroy-all
  VERCEL_TOKEN=... pnpm vercel:sandboxes:destroy-all --slug my-team
  VERCEL_TOKEN=... pnpm vercel:sandboxes:destroy-all --slug my-team --execute
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
    slug: process.env.VERCEL_TEAM_SLUG ?? process.env.VERCEL_SCOPE ?? '',
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
      case '--slug':
      case '--team':
      case '--scope':
        options.slug = argv[index + 1] ?? ''
        index += 1
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function buildQuery(
  params: Record<string, string | number | null | undefined>
): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

async function vercelRequest<T>(
  pathname: string,
  context: VercelContext,
  init: RequestInit = {}
): Promise<T | null> {
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${context.token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  if (response.status === 204) {
    return null
  }

  const rawBody = await response.text()
  const body = rawBody ? safeJsonParse(rawBody) : null

  if (!response.ok) {
    const message =
      body?.error?.message ??
      body?.message ??
      body?.error?.code ??
      response.statusText

    throw new Error(`${response.status} ${response.statusText}: ${message}`)
  }

  return body as T
}

function safeJsonParse(value: string): JsonErrorBody {
  try {
    return JSON.parse(value) as JsonErrorBody
  } catch {
    return { raw: value }
  }
}

function toProjectRef(project: ProjectApiEntry): ProjectRef | null {
  const id = project.id ?? project.projectId ?? project.uid ?? project.name
  if (!id) {
    return null
  }

  return {
    id,
    name: project.name ?? project.project?.name ?? id,
  }
}

function toNamedSandbox(
  sandbox: NamedSandboxApiEntry,
  project: ProjectRef
): NamedSandbox | null {
  if (!sandbox.name) {
    return null
  }

  return {
    ...sandbox,
    name: sandbox.name,
    projectId: project.id,
    projectName: project.name,
  }
}

function toStandaloneSandbox(
  sandbox: StandaloneSandboxApiEntry,
  project: ProjectRef,
  namedSessionIds: ReadonlySet<string>
): StandaloneSandbox | null {
  const sandboxId = sandbox.id
  const status = String(sandbox.status ?? '').toLowerCase()

  if (!sandboxId) {
    return null
  }

  if (namedSessionIds.has(sandboxId)) {
    return null
  }

  if (TERMINAL_SANDBOX_STATUSES.has(status)) {
    return null
  }

  return {
    ...sandbox,
    id: sandboxId,
    projectId: project.id,
    projectName: project.name,
  }
}

async function listProjects(
  context: VercelContext,
  explicitProject: string
): Promise<ProjectRef[]> {
  if (explicitProject) {
    return [{ id: explicitProject, name: explicitProject }]
  }

  const projects: ProjectRef[] = []
  let cursor = ''

  do {
    const response = await vercelRequest<ProjectListResponse>(
      `/v10/projects${buildQuery({
        limit: VERCEL_PAGE_LIMIT,
        from: cursor,
        teamId: context.teamId,
        slug: context.slug,
      })}`,
      context
    )

    const batch = Array.isArray(response?.projects) ? response.projects : []
    for (const project of batch) {
      const normalizedProject = toProjectRef(project)
      if (!normalizedProject) {
        continue
      }

      projects.push(normalizedProject)
    }

    cursor = response?.pagination?.next ?? ''
  } while (cursor)

  const dedupedProjects: ProjectRef[] = []
  const seenProjectIds = new Set<string>()

  for (const project of projects) {
    if (seenProjectIds.has(project.id)) {
      continue
    }

    dedupedProjects.push(project)
    seenProjectIds.add(project.id)
  }

  return dedupedProjects
}

async function listNamedSandboxes(
  project: ProjectRef,
  context: VercelContext
): Promise<NamedSandbox[]> {
  const sandboxes: NamedSandbox[] = []
  let cursor = ''
  const seenCursors = new Set<string>()

  do {
    if (cursor) {
      if (seenCursors.has(cursor)) {
        throw new Error(
          `Repeated pagination cursor while listing named sandboxes for project ${project.id}.`
        )
      }

      seenCursors.add(cursor)
    }

    const response = await vercelRequest<NamedSandboxListResponse>(
      `/v2/sandboxes${buildQuery({
        project: project.id,
        limit: VERCEL_PAGE_LIMIT,
        cursor,
        teamId: context.teamId,
        slug: context.slug,
      })}`,
      context
    )

    const batch = Array.isArray(response?.sandboxes) ? response.sandboxes : []
    for (const sandbox of batch) {
      const normalizedSandbox = toNamedSandbox(sandbox, project)
      if (!normalizedSandbox) {
        continue
      }

      sandboxes.push(normalizedSandbox)
    }

    cursor = response?.pagination?.next ?? ''
  } while (cursor)

  return sandboxes
}

async function listStandaloneRunningSandboxes(
  project: ProjectRef,
  namedSessionIds: ReadonlySet<string>,
  context: VercelContext
): Promise<StandaloneSandbox[]> {
  const sandboxes: StandaloneSandbox[] = []
  let until = ''
  const seenPaginationTokens = new Set<string>()

  do {
    if (until) {
      if (seenPaginationTokens.has(until)) {
        throw new Error(
          `Repeated pagination token while listing active sandboxes for project ${project.id}.`
        )
      }

      seenPaginationTokens.add(until)
    }

    const response = await vercelRequest<StandaloneSandboxListResponse>(
      `/v1/sandboxes${buildQuery({
        project: project.id,
        limit: VERCEL_PAGE_LIMIT,
        until,
        teamId: context.teamId,
        slug: context.slug,
      })}`,
      context
    )

    const batch = Array.isArray(response?.sandboxes) ? response.sandboxes : []
    for (const sandbox of batch) {
      const normalizedSandbox = toStandaloneSandbox(
        sandbox,
        project,
        namedSessionIds
      )
      if (!normalizedSandbox) {
        continue
      }

      sandboxes.push(normalizedSandbox)
    }

    until = response?.pagination?.next ?? ''
  } while (until)

  return sandboxes
}

function printGroup<T>(
  title: string,
  entries: readonly T[],
  formatter: (entry: T) => string
): void {
  if (entries.length === 0) {
    return
  }

  console.log(`\n${title}`)
  for (const entry of entries) {
    console.log(`  - ${formatter(entry)}`)
  }
}

function printPlan(
  namedSandboxes: readonly NamedSandbox[],
  standaloneRunningSandboxes: readonly StandaloneSandbox[]
): void {
  console.log(
    `Found ${namedSandboxes.length} named sandboxes to delete and ${standaloneRunningSandboxes.length} standalone running sandboxes to stop.`
  )

  printGroup('Named sandboxes', namedSandboxes, (sandbox) => {
    const status = sandbox.status ? ` [${sandbox.status}]` : ''
    return `${sandbox.projectName}: ${sandbox.name}${status}`
  })

  printGroup(
    'Standalone running sandboxes',
    standaloneRunningSandboxes,
    (sandbox) => {
      const status = sandbox.status ? ` [${sandbox.status}]` : ''
      return `${sandbox.projectName}: ${sandbox.id}${status}`
    }
  )
}

async function confirmExecution(
  namedCount: number,
  standaloneCount: number
): Promise<boolean> {
  const total = namedCount + standaloneCount
  const prompt = `Type DESTROY ${total} to continue: `
  const expectedAnswer = `DESTROY ${total}`

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

async function deleteNamedSandbox(
  sandbox: NamedSandbox,
  context: VercelContext
): Promise<void> {
  await vercelRequest(
    `/v2/sandboxes/${encodeURIComponent(sandbox.name)}${buildQuery({
      projectId: sandbox.projectId,
      teamId: context.teamId,
      slug: context.slug,
    })}`,
    context,
    { method: 'DELETE' }
  )
}

async function stopStandaloneSandbox(
  sandbox: StandaloneSandbox,
  context: VercelContext
): Promise<void> {
  await vercelRequest(
    `/v1/sandboxes/${encodeURIComponent(sandbox.id)}/stop${buildQuery({
      teamId: context.teamId,
      slug: context.slug,
    })}`,
    context,
    { method: 'POST' }
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
      'Using VERCEL_OIDC_TOKEN. For account-wide cleanup, a VERCEL_TOKEN is usually more reliable.'
    )
  }

  return token
}

async function scanSandboxes(
  projects: readonly ProjectRef[],
  context: VercelContext
): Promise<{
  namedSandboxes: NamedSandbox[]
  standaloneRunningSandboxes: StandaloneSandbox[]
}> {
  const namedSandboxes: NamedSandbox[] = []
  for (const project of projects) {
    const sandboxes = await listNamedSandboxes(project, context)
    namedSandboxes.push(...sandboxes)
  }

  const namedSessionIds = new Set(
    namedSandboxes
      .map((sandbox) => sandbox.currentSessionId)
      .filter(
        (sessionId): sessionId is string =>
          typeof sessionId === 'string' && sessionId.length > 0
      )
  )

  const standaloneRunningSandboxes: StandaloneSandbox[] = []
  for (const project of projects) {
    const sandboxes = await listStandaloneRunningSandboxes(
      project,
      namedSessionIds,
      context
    )
    standaloneRunningSandboxes.push(...sandboxes)
  }

  return { namedSandboxes, standaloneRunningSandboxes }
}

async function ensureExecutionAllowed(
  options: ScriptOptions,
  namedSandboxes: readonly NamedSandbox[],
  standaloneRunningSandboxes: readonly StandaloneSandbox[]
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

  const confirmed = await confirmExecution(
    namedSandboxes.length,
    standaloneRunningSandboxes.length
  )

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

async function applyCleanup(
  namedSandboxes: readonly NamedSandbox[],
  standaloneRunningSandboxes: readonly StandaloneSandbox[],
  context: VercelContext
): Promise<CleanupFailure[]> {
  const failures: CleanupFailure[] = []

  for (const sandbox of namedSandboxes) {
    try {
      await deleteNamedSandbox(sandbox, context)
      console.log(
        `[deleted] ${sandbox.projectName}: ${sandbox.name} (${sandbox.projectId})`
      )
    } catch (error) {
      failures.push({
        target: `${sandbox.projectName}: ${sandbox.name}`,
        error,
      })
    }
  }

  for (const sandbox of standaloneRunningSandboxes) {
    try {
      await stopStandaloneSandbox(sandbox, context)
      console.log(
        `[stopped] ${sandbox.projectName}: ${sandbox.id} (${sandbox.projectId})`
      )
    } catch (error) {
      failures.push({
        target: `${sandbox.projectName}: ${sandbox.id}`,
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

  const context: VercelContext = {
    token: resolveToken(),
    teamId: options.teamId,
    slug: options.slug,
  }

  console.log('Resolving projects...')
  const projects = await listProjects(context, options.project)

  if (projects.length === 0) {
    console.log('No projects found for the selected scope.')
    return
  }

  console.log(`Scanning ${projects.length} project(s) for sandboxes...`)

  const { namedSandboxes, standaloneRunningSandboxes } = await scanSandboxes(
    projects,
    context
  )

  printPlan(namedSandboxes, standaloneRunningSandboxes)

  if (namedSandboxes.length === 0 && standaloneRunningSandboxes.length === 0) {
    console.log('\nNothing to do.')
    return
  }

  const shouldExecute = await ensureExecutionAllowed(
    options,
    namedSandboxes,
    standaloneRunningSandboxes
  )
  if (!shouldExecute) {
    return
  }

  const failures = await applyCleanup(
    namedSandboxes,
    standaloneRunningSandboxes,
    context
  )

  if (failures.length > 0) {
    printFailures(failures)
    process.exitCode = 1
    return
  }

  console.log(
    `\nCleanup complete for ${namedSandboxes.length} named sandboxes and ${standaloneRunningSandboxes.length} standalone running sandboxes.`
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Failed: ${message}`)
  process.exitCode = 1
})
