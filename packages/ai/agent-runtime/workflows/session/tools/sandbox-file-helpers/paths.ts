import { isReadOnlyForAgent } from '../persona-paths'

export const FILE_TOOL_SANDBOX_ROOT = '/vercel/sandbox'

const MAX_PATH_CHARS = 512
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

const RUNTIME_OWNED_PREFIXES = ['memory/.dreams'] as const

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
  assertAgentVisibleSandboxPath(path)
  if (isReadOnlyForAgent(path.relPath)) {
    throw new SandboxPathError(
      `${path.relPath} is user-owned and can only be changed through the agent settings UI.`
    )
  }
}

export function assertAgentVisibleSandboxPath(
  path: NormalizedSandboxPath
): void {
  if (isRuntimeOwnedPath(path.relPath)) {
    throw new SandboxPathError(
      `${path.relPath} is managed by the platform runtime and is hidden from agent file tools.`
    )
  }
}

export function isRuntimeOwnedPath(relPath: string): boolean {
  return RUNTIME_OWNED_PREFIXES.some(
    (prefix) => relPath === prefix || relPath.startsWith(`${prefix}/`)
  )
}

export function isTrackedArchitecturePath(relPath: string): boolean {
  return (
    CANONICAL_ARCHITECTURE_FILES.has(relPath) ||
    LOG_ARCHITECTURE_PATH_RE.test(relPath)
  )
}

export function relativeToSandboxRoot(absPath: string): string {
  const normalized = normalizePosixPath(absPath)
  if (normalized === FILE_TOOL_SANDBOX_ROOT) {
    return ''
  }
  if (normalized.startsWith(`${FILE_TOOL_SANDBOX_ROOT}/`)) {
    return normalized.slice(FILE_TOOL_SANDBOX_ROOT.length + 1)
  }
  return `../${normalized.replace(LEADING_SLASHES_RE, '')}`
}

export function isSafeRelativePath(relPath: string): boolean {
  return (
    relPath === '' ||
    !(relPath === '..' || relPath.startsWith('../') || relPath.startsWith('/'))
  )
}

export function matchesPrefix(relPath: string, prefix: string): boolean {
  return (
    prefix.length === 0 ||
    relPath === prefix ||
    relPath.startsWith(`${prefix.replace(TRAILING_SLASHES_RE, '')}/`)
  )
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
