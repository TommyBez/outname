import { RepoWorkspaceInputError, RepoWorkspaceProviderError } from './errors'
import {
  assertReadableRepoWorkspacePath,
  assertWritableRepoWorkspacePath,
  matchesRepoWorkspacePrefix,
  normalizeRepoWorkspacePath,
  normalizeRepoWorkspacePrefix,
} from './paths'
import { shellQuote } from './shell'
import type {
  RepoWorkspace,
  RepoWorkspaceCommandResult,
  RepoWorkspaceFileWrite,
  RepoWorkspaceGrepInput,
  RepoWorkspaceGrepMatch,
  RepoWorkspaceListInput,
  RepoWorkspaceReadFileResult,
  RepoWorkspaceWriteFileResult,
} from './types'

const DEFAULT_LIST_RESULTS = 1000
const LONG_LINE_CHARS = 240
const MAX_GREP_RESULTS = 200
const LEADING_CURRENT_DIRECTORY_PATTERN = /^\.\//

type BashToolExecute<TInput, TOutput> = (input: TInput) => Promise<TOutput>

export async function runRepoWorkspaceCommand(
  workspace: RepoWorkspace,
  command: string
): Promise<RepoWorkspaceCommandResult> {
  const execute = workspace.bashTool.bash.execute as BashToolExecute<
    { command: string },
    RepoWorkspaceCommandResult
  >
  return await execute({ command })
}

export async function readRepoWorkspaceFile(
  workspace: RepoWorkspace,
  path: string
): Promise<{ content: string; path: string }> {
  const safe = normalizeRepoWorkspacePath(path, workspace.rootPath)
  assertReadableRepoWorkspacePath(safe)

  const execute = workspace.bashTool.tools.readFile.execute as BashToolExecute<
    { path: string },
    RepoWorkspaceReadFileResult
  >
  const result = await execute({ path: safe.relPath })
  return { content: result.content, path: safe.relPath }
}

export async function writeRepoWorkspaceFiles(
  workspace: RepoWorkspace,
  files: RepoWorkspaceFileWrite[]
): Promise<{ paths: string[] }> {
  if (files.length === 0) {
    throw new RepoWorkspaceInputError('Provide at least one file to write.')
  }

  const execute = workspace.bashTool.tools.writeFile.execute as BashToolExecute<
    { content: string; path: string },
    RepoWorkspaceWriteFileResult
  >

  const writtenPaths: string[] = []
  for (const file of files) {
    const safe = normalizeRepoWorkspacePath(file.path, workspace.rootPath)
    assertWritableRepoWorkspacePath(safe)
    await execute({ path: safe.relPath, content: file.content })
    writtenPaths.push(safe.relPath)
  }

  return { paths: writtenPaths }
}

export async function listRepoWorkspaceFiles(
  workspace: RepoWorkspace,
  input: RepoWorkspaceListInput = {}
): Promise<{ paths: string[]; truncated: boolean }> {
  const prefix = normalizeRepoWorkspacePrefix(
    input.pathPrefix,
    workspace.rootPath
  )
  const maxResults = Math.min(
    Math.max(input.maxResults ?? DEFAULT_LIST_RESULTS, 1),
    DEFAULT_LIST_RESULTS
  )
  const searchRoot = prefix.relPath.length === 0 ? '.' : prefix.relPath

  const command = [
    `find ${shellQuote(searchRoot)} -type d -name .git -prune -o -type f -print`,
    "sed 's#^\\./##'",
    'sort',
  ].join(' | ')

  const result = await runRepoWorkspaceCommand(workspace, command)
  if (result.exitCode !== 0) {
    throw new RepoWorkspaceProviderError(
      result.stderr.trim() || 'Failed to list repository files.'
    )
  }

  const paths = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((relPath) => matchesRepoWorkspacePrefix(relPath, prefix.relPath))

  return {
    paths: paths.slice(0, maxResults),
    truncated: paths.length > maxResults,
  }
}

export async function grepRepoWorkspaceFiles(
  workspace: RepoWorkspace,
  input: RepoWorkspaceGrepInput
): Promise<{ matches: RepoWorkspaceGrepMatch[]; truncated: boolean }> {
  const prefix = normalizeRepoWorkspacePrefix(
    input.pathPrefix,
    workspace.rootPath
  )
  const maxResults = Math.min(Math.max(input.maxResults, 1), MAX_GREP_RESULTS)
  const searchRoot = prefix.relPath.length === 0 ? '.' : prefix.relPath
  const grepFlags = [
    '-RInI',
    input.fixedString ? '-F' : '-E',
    '--binary-files=without-match',
    '--exclude-dir=.git',
  ]
  if (input.caseInsensitive) {
    grepFlags.push('-i')
  }

  const grepCommand = [
    'grep',
    ...grepFlags,
    '--',
    shellQuote(input.pattern),
    shellQuote(searchRoot),
  ].join(' ')
  const command = `set -o pipefail && ${grepCommand} | head -n ${maxResults + 1}`

  const result = await runRepoWorkspaceCommand(workspace, command)
  if (result.exitCode > 1) {
    throw new RepoWorkspaceProviderError(
      result.stderr.trim() || 'Failed to search repository files.'
    )
  }

  const lines = result.stdout.split('\n').filter(Boolean)
  const matches = lines
    .map(parseGrepLine)
    .filter((match): match is RepoWorkspaceGrepMatch => match !== null)
    .filter((match) => matchesRepoWorkspacePrefix(match.path, prefix.relPath))
    .slice(0, maxResults)

  return {
    matches,
    truncated: lines.length > maxResults,
  }
}

function parseGrepLine(line: string): RepoWorkspaceGrepMatch | null {
  const firstColon = line.indexOf(':')
  if (firstColon <= 0) {
    return null
  }
  const secondColon = line.indexOf(':', firstColon + 1)
  if (secondColon <= firstColon) {
    return null
  }

  const path = line
    .slice(0, firstColon)
    .replace(LEADING_CURRENT_DIRECTORY_PATTERN, '')
  const safe = normalizeRepoWorkspacePath(path)
  assertReadableRepoWorkspacePath(safe)

  const lineNumber = Number.parseInt(
    line.slice(firstColon + 1, secondColon),
    10
  )
  if (!Number.isFinite(lineNumber)) {
    return null
  }

  const text = line.slice(secondColon + 1)
  return {
    path: safe.relPath,
    line: lineNumber,
    text:
      text.length > LONG_LINE_CHARS
        ? `${text.slice(0, LONG_LINE_CHARS)}...`
        : text,
  }
}
