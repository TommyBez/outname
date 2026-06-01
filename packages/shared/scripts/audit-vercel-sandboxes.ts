import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Sandbox } from '@vercel/sandbox'
import {
  getVercelSandboxCredentials,
  type VercelSandboxCredentials,
  withVercelSandboxCredentials,
} from '../server/vercel-sandbox-config'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const VERCEL_PAGE_LIMIT = 50
const ENV_LINE_SPLITTER = /\r?\n/u

interface ParsedEnvLine {
  key: string
  value: string
}

interface ScriptOptions {
  help: boolean
}

interface ProjectRef {
  id: string
  name: string
}

type ListedSandbox = Awaited<
  ReturnType<typeof Sandbox.list>
>['sandboxes'][number]

function printUsage(): void {
  console.log(`Audit Vercel sandboxes for the current Vercel project.

Usage:
  pnpm vercel:sandboxes:audit [options]
  pnpm exec tsx packages/shared/scripts/audit-vercel-sandboxes.ts [options]

Options:
  --help                  Show this help text.

Environment:
  SANDBOX_TEAM_ID          Vercel team id for Sandbox API calls.
  SANDBOX_PROJECT_ID      Vercel project id for Sandbox API calls.
  SANDBOX_ACCESS_TOKEN     Vercel access token for Sandbox API calls.
`)
}

function loadDotEnvFiles(): void {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.join(REPO_ROOT, fileName)
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
    help: false,
  }

  for (const arg of argv) {
    switch (arg) {
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

function renderValue(value: string | number | boolean | undefined): string {
  if (value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

function renderResources(sandbox: ListedSandbox): string {
  if (!(sandbox.vcpus || sandbox.memory)) {
    return '-'
  }

  return `${sandbox.vcpus ?? '?'} vCPU / ${sandbox.memory ?? '?'} MB`
}

function renderStorageAllocation(): string {
  return 'not exposed by SDK metadata'
}

function renderTags(tags: Record<string, string> | undefined): string[] {
  if (!tags || Object.keys(tags).length === 0) {
    return ['    -']
  }

  return Object.entries(tags)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `    ${key.padEnd(14)} ${value}`)
}

function renderField(label: string, value: string): string {
  return `  ${label.padEnd(16)} ${value}`
}

function printSandbox(sandbox: ListedSandbox, index: number): void {
  console.log(`\n${index + 1}. ${sandbox.name}`)
  console.log(renderField('status', sandbox.status))
  console.log(renderField('persistent', sandbox.persistent ? 'yes' : 'no'))
  console.log(renderField('runtime', renderValue(sandbox.runtime)))
  console.log(renderField('resources', renderResources(sandbox)))
  console.log(renderField('storage', renderStorageAllocation()))
  console.log(
    renderField('current session', renderValue(sandbox.currentSessionId))
  )
  console.log(
    renderField('current snapshot', renderValue(sandbox.currentSnapshotId))
  )
  console.log('  tags')
  for (const line of renderTags(sandbox.tags)) {
    console.log(line)
  }
}

async function main(): Promise<void> {
  loadDotEnvFiles()

  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }

  const project = resolveSandboxProject(getVercelSandboxCredentials())

  console.log(
    `Auditing current Vercel project sandboxes: ${project.name} (${project.id})`
  )
  const sandboxes = await listSandboxes(project)
  if (sandboxes.length === 0) {
    console.log('No named sandboxes found.')
    return
  }

  console.log(`Found ${sandboxes.length} named sandbox(es).`)
  for (let index = 0; index < sandboxes.length; index += 1) {
    printSandbox(sandboxes[index], index)
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Failed: ${message}`)
  process.exitCode = 1
})
