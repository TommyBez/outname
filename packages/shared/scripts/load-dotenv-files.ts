import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ENV_LINE_SPLITTER = /\r?\n/u
const ENV_FILE_NAMES = ['.env.local', '.env'] as const
const SKIPPED_ENV_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'build',
  'coverage',
  'dist',
  'node_modules',
])

interface ParsedEnvLine {
  key: string
  value: string
}

function collectEnvFilePaths(
  directory: string,
  results: string[] = []
): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (SKIPPED_ENV_DIRS.has(entry.name)) {
        continue
      }
      collectEnvFilePaths(entryPath, results)
      continue
    }

    if (
      entry.isFile() &&
      ENV_FILE_NAMES.includes(entry.name as (typeof ENV_FILE_NAMES)[number])
    ) {
      results.push(entryPath)
    }
  }

  return results
}

function compareEnvFilePaths(
  repoRoot: string,
  leftPath: string,
  rightPath: string
): number {
  const leftDir = path.dirname(leftPath)
  const rightDir = path.dirname(rightPath)
  const leftIsRoot = leftDir === repoRoot ? 0 : 1
  const rightIsRoot = rightDir === repoRoot ? 0 : 1
  if (leftIsRoot !== rightIsRoot) {
    return leftIsRoot - rightIsRoot
  }

  const leftDepth = path
    .relative(repoRoot, leftDir)
    .split(path.sep)
    .filter(Boolean).length
  const rightDepth = path
    .relative(repoRoot, rightDir)
    .split(path.sep)
    .filter(Boolean).length
  if (leftDepth !== rightDepth) {
    return leftDepth - rightDepth
  }

  const leftIsLocal = path.basename(leftPath) === '.env.local' ? 0 : 1
  const rightIsLocal = path.basename(rightPath) === '.env.local' ? 0 : 1
  if (leftIsLocal !== rightIsLocal) {
    return leftIsLocal - rightIsLocal
  }

  return leftPath.localeCompare(rightPath)
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

function loadEnvFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(ENV_LINE_SPLITTER)) {
    const parsedEntry = parseEnvLine(rawLine)
    if (!parsedEntry || process.env[parsedEntry.key] !== undefined) {
      continue
    }

    process.env[parsedEntry.key] = parsedEntry.value
  }
}

export function loadDotEnvFiles(repoRoot: string): void {
  const envFilePaths = collectEnvFilePaths(repoRoot).sort(
    (leftPath, rightPath) => compareEnvFilePaths(repoRoot, leftPath, rightPath)
  )
  for (const filePath of envFilePaths) {
    loadEnvFile(filePath)
  }
}
