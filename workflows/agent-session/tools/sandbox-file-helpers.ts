import type { Sandbox } from '@vercel/sandbox'
import { isReadOnlyForAgent } from './persona-paths'

export const FILE_TOOL_SANDBOX_ROOT = '/vercel/sandbox'
export const MAX_READ_FILE_BYTES = 256 * 1024

const MAX_PATH_CHARS = 512
const MAX_LIST_RESULTS = 1000
const LONG_LINE_CHARS = 240
const LOG_ARCHITECTURE_PATH_RE = /^logs\/[^/]+\.md$/
const LEADING_SLASHES_RE = /^\/+/
const TRAILING_SLASHES_RE = /\/+$/

const CANONICAL_ARCHITECTURE_FILES = new Set([
  'AGENTS.md',
  'IDENTITY.md',
  'SOUL.md',
  'USER.md',
  'MEMORY.md',
  'TASKS.md',
  'CALENDAR.md',
  'GOALS.md',
  'DREAMS.md',
])

export interface NormalizedSandboxPath {
  absPath: string
  relPath: string
}

export class SandboxPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SandboxPathError'
  }
}

export function normalizeSandboxPath(rawPath: string): NormalizedSandboxPath {
  const normalized = normalizeSandboxPathInternal(rawPath)
  if (normalized.relPath.length === 0) {
    throw new SandboxPathError(
      'path must refer to a file, not the sandbox root'
    )
  }
  return normalized
}

export function normalizeSandboxPrefix(
  rawPath?: string
): NormalizedSandboxPath {
  if (rawPath === undefined || rawPath.length === 0 || rawPath === '.') {
    return { absPath: FILE_TOOL_SANDBOX_ROOT, relPath: '' }
  }
  return normalizeSandboxPathInternal(rawPath)
}

export function assertWritableSandboxPath(path: NormalizedSandboxPath): void {
  if (isReadOnlyForAgent(path.relPath)) {
    throw new SandboxPathError(
      `${path.relPath} is user-owned and can only be changed through the agent settings UI.`
    )
  }
}

export function isTrackedArchitecturePath(relPath: string): boolean {
  return (
    CANONICAL_ARCHITECTURE_FILES.has(relPath) ||
    LOG_ARCHITECTURE_PATH_RE.test(relPath)
  )
}

/**
 * Read a UTF-8 text file from the persistent system sandbox. Returns
 * null if the path is missing. Throws if the path escapes the sandbox,
 * is too large for model-facing reads, or is not valid UTF-8 text.
 */
export function readLiveFile(
  sandbox: Sandbox,
  rawPath: string
): Promise<string | null> {
  const safe = normalizeSandboxPath(rawPath)
  return readLiveFileByPath(sandbox, safe)
}

export async function readLiveFileByPath(
  sandbox: Sandbox,
  safe: NormalizedSandboxPath
): Promise<string | null> {
  const buf = await sandbox
    .readFileToBuffer({ path: safe.absPath })
    .catch(() => null)
  if (!buf) {
    return null
  }
  if (buf.byteLength > MAX_READ_FILE_BYTES) {
    throw new Error(
      `readFile: ${safe.relPath} is ${buf.byteLength} bytes; max readable size is ${MAX_READ_FILE_BYTES} bytes.`
    )
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    throw new Error(`readFile: ${safe.relPath} is not valid UTF-8 text.`)
  }
}

/**
 * Compatibility name for eager context readers.
 */
export function readLiveMemory(
  sandbox: Sandbox,
  path: string
): Promise<string | null> {
  return readLiveFile(sandbox, path)
}

export async function listLiveFiles(
  sandbox: Sandbox,
  input: {
    maxResults?: number
    pathPrefix?: string
  } = {}
): Promise<{ paths: string[]; truncated: boolean }> {
  const maxResults = Math.min(
    Math.max(input.maxResults ?? MAX_LIST_RESULTS, 1),
    MAX_LIST_RESULTS
  )
  const paths = await listAllLiveFilePaths(sandbox, input.pathPrefix)

  return {
    paths: paths.slice(0, maxResults),
    truncated: paths.length > maxResults,
  }
}

export async function listTrackedArchitectureFiles(
  sandbox: Sandbox
): Promise<string[]> {
  const paths = await listAllLiveFilePaths(sandbox)
  return paths.filter(isTrackedArchitecturePath).sort()
}

export interface GrepFilesArgs {
  caseInsensitive: boolean
  fixedString: boolean
  maxResults: number
  pathPrefix: string
  pattern: string
}

export interface GrepMatch {
  line: number
  path: string
  text: string
}

export async function grepLiveFiles(
  sandbox: Sandbox,
  args: GrepFilesArgs
): Promise<{ matches: GrepMatch[]; truncated: boolean }> {
  const prefix = normalizeSandboxPrefix(args.pathPrefix)
  const maxResults = Math.min(Math.max(args.maxResults, 1), 200)
  const grepArgs = [
    '-RInI',
    args.fixedString ? '-F' : '-E',
    '-m',
    String(maxResults),
    '--binary-files=without-match',
  ]
  if (args.caseInsensitive) {
    grepArgs.push('-i')
  }
  grepArgs.push('--', args.pattern, prefix.absPath)

  const result = await sandbox.runCommand({
    cmd: 'grep',
    args: grepArgs,
  })
  const stdout = await result.stdout()
  const stderr = await result.stderr()
  const { exitCode } = result
  if (exitCode > 1) {
    throw new Error(
      stderr.trim() || `grepFiles failed with exit code ${exitCode}`
    )
  }

  const lines = stdout.split('\n').filter(Boolean)
  const matches = lines
    .map(parseGrepLine)
    .filter((match): match is GrepMatch => match !== null)
    .filter((match) => isSafeRelativePath(match.path))
    .slice(0, maxResults)

  return {
    matches,
    truncated: lines.length > maxResults,
  }
}

function normalizeSandboxPathInternal(rawPath: string): NormalizedSandboxPath {
  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    throw new SandboxPathError('path must be a non-empty string')
  }
  if (rawPath.length > MAX_PATH_CHARS) {
    throw new SandboxPathError(
      `path is too long (max ${MAX_PATH_CHARS} characters)`
    )
  }
  if (rawPath.includes('\0')) {
    throw new SandboxPathError('path may not contain NUL bytes')
  }

  const candidate = rawPath.startsWith('/')
    ? rawPath
    : `${FILE_TOOL_SANDBOX_ROOT}/${rawPath}`
  const absPath = normalizePosixPath(candidate)
  const relPath = relativeToSandboxRoot(absPath)
  if (!isSafeRelativePath(relPath)) {
    throw new SandboxPathError(
      `path must stay under ${FILE_TOOL_SANDBOX_ROOT}; got ${rawPath}`
    )
  }
  return { absPath, relPath }
}

async function listAllLiveFilePaths(
  sandbox: Sandbox,
  pathPrefix?: string
): Promise<string[]> {
  const prefix = normalizeSandboxPrefix(pathPrefix)
  const list = await sandbox.runCommand({
    cmd: 'find',
    args: [FILE_TOOL_SANDBOX_ROOT, '-type', 'f', '-print'],
  })
  const stdout = await list.stdout()
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((absPath) => relativeToSandboxRoot(absPath))
    .filter((relPath) => isSafeRelativePath(relPath))
    .filter((relPath) => matchesPrefix(relPath, prefix.relPath))
    .sort()
}

function normalizePosixPath(input: string): string {
  const absolute = input.startsWith('/')
  const stack: string[] = []
  for (const segment of input.split('/')) {
    if (segment.length === 0 || segment === '.') {
      continue
    }
    if (segment === '..') {
      if (stack.length > 0 && stack.at(-1) !== '..') {
        stack.pop()
      } else if (!absolute) {
        stack.push(segment)
      }
      continue
    }
    stack.push(segment)
  }
  return `${absolute ? '/' : ''}${stack.join('/')}` || '.'
}

function relativeToSandboxRoot(absPath: string): string {
  const normalized = normalizePosixPath(absPath)
  if (normalized === FILE_TOOL_SANDBOX_ROOT) {
    return ''
  }
  if (normalized.startsWith(`${FILE_TOOL_SANDBOX_ROOT}/`)) {
    return normalized.slice(FILE_TOOL_SANDBOX_ROOT.length + 1)
  }
  return `../${normalized.replace(LEADING_SLASHES_RE, '')}`
}

function isSafeRelativePath(relPath: string): boolean {
  return (
    relPath === '' ||
    !(relPath === '..' || relPath.startsWith('../') || relPath.startsWith('/'))
  )
}

function matchesPrefix(relPath: string, prefix: string): boolean {
  return (
    prefix.length === 0 ||
    relPath === prefix ||
    relPath.startsWith(`${prefix.replace(TRAILING_SLASHES_RE, '')}/`)
  )
}

function parseGrepLine(line: string): GrepMatch | null {
  const firstColon = line.indexOf(':')
  if (firstColon <= 0) {
    return null
  }
  const secondColon = line.indexOf(':', firstColon + 1)
  if (secondColon <= firstColon) {
    return null
  }
  const absPath = line.slice(0, firstColon)
  const relPath = relativeToSandboxRoot(absPath)
  const lineNumber = Number.parseInt(
    line.slice(firstColon + 1, secondColon),
    10
  )
  if (!Number.isFinite(lineNumber)) {
    return null
  }
  const text = line.slice(secondColon + 1)
  return {
    path: relPath,
    line: lineNumber,
    text:
      text.length > LONG_LINE_CHARS
        ? `${text.slice(0, LONG_LINE_CHARS)}...`
        : text,
  }
}
