import type { Sandbox } from '@vercel/sandbox'
import {
  isSafeRelativePath,
  normalizeSandboxPrefix,
  relativeToSandboxRoot,
} from './paths'

const LONG_LINE_CHARS = 240

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

  let result: Awaited<ReturnType<Sandbox['runCommand']>>
  try {
    result = await sandbox.runCommand({
      cmd: 'grep',
      args: grepArgs,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`grepFiles: ${message}`)
  }
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
