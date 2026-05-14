import { RepoWorkspaceInputError } from './errors'

export const REPO_WORKSPACE_ROOT = '/vercel/sandbox/repo'

const MAX_PATH_CHARS = 512
const LEADING_SLASHES_RE = /^\/+/
const TRAILING_SLASHES_RE = /\/+$/

export interface NormalizedRepoWorkspacePath {
  absPath: string
  relPath: string
}

export function normalizeRepoWorkspacePath(
  rawPath: string,
  rootPath = REPO_WORKSPACE_ROOT
): NormalizedRepoWorkspacePath {
  const normalized = normalizeRepoWorkspacePathInternal(rawPath, rootPath)
  if (normalized.relPath.length === 0) {
    throw new RepoWorkspaceInputError(
      'path must refer to a file, not the repository root'
    )
  }
  return normalized
}

export function normalizeRepoWorkspacePrefix(
  rawPath?: string,
  rootPath = REPO_WORKSPACE_ROOT
): NormalizedRepoWorkspacePath {
  if (rawPath === undefined || rawPath.length === 0 || rawPath === '.') {
    return { absPath: rootPath, relPath: '' }
  }
  return normalizeRepoWorkspacePathInternal(rawPath, rootPath)
}

export function assertReadableRepoWorkspacePath(
  path: NormalizedRepoWorkspacePath
): void {
  if (isGitMetadataPath(path.relPath)) {
    throw new RepoWorkspaceInputError(
      '.git metadata is not exposed through repo workspace file tools.'
    )
  }
}

export function assertWritableRepoWorkspacePath(
  path: NormalizedRepoWorkspacePath
): void {
  if (isGitMetadataPath(path.relPath)) {
    throw new RepoWorkspaceInputError(
      '.git metadata is managed by git and cannot be written through repo workspace file tools.'
    )
  }
}

export function isSafeRepoWorkspacePath(relPath: string): boolean {
  return (
    relPath === '' ||
    !(relPath === '..' || relPath.startsWith('../') || relPath.startsWith('/'))
  )
}

export function matchesRepoWorkspacePrefix(
  relPath: string,
  prefix: string
): boolean {
  return (
    prefix.length === 0 ||
    relPath === prefix ||
    relPath.startsWith(`${prefix.replace(TRAILING_SLASHES_RE, '')}/`)
  )
}

export function relativeToRepoWorkspaceRoot(
  absPath: string,
  rootPath = REPO_WORKSPACE_ROOT
): string {
  const normalized = normalizePosixPath(absPath)
  if (normalized === rootPath) {
    return ''
  }
  if (normalized.startsWith(`${rootPath}/`)) {
    return normalized.slice(rootPath.length + 1)
  }
  return `../${normalized.replace(LEADING_SLASHES_RE, '')}`
}

function normalizeRepoWorkspacePathInternal(
  rawPath: string,
  rootPath: string
): NormalizedRepoWorkspacePath {
  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    throw new RepoWorkspaceInputError('path must be a non-empty string')
  }
  if (rawPath.length > MAX_PATH_CHARS) {
    throw new RepoWorkspaceInputError(
      `path is too long (max ${MAX_PATH_CHARS} characters)`
    )
  }
  if (rawPath.includes('\0')) {
    throw new RepoWorkspaceInputError('path may not contain NUL bytes')
  }

  const candidate = rawPath.startsWith('/') ? rawPath : `${rootPath}/${rawPath}`
  const absPath = normalizePosixPath(candidate)
  const relPath = relativeToRepoWorkspaceRoot(absPath, rootPath)
  if (!isSafeRepoWorkspacePath(relPath)) {
    throw new RepoWorkspaceInputError(
      `path must stay under ${rootPath}; got ${rawPath}`
    )
  }

  return { absPath, relPath }
}

function isGitMetadataPath(relPath: string): boolean {
  return relPath === '.git' || relPath.startsWith('.git/')
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
