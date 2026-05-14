import { RepoWorkspaceInputError, RepoWorkspaceProviderError } from './errors'
import { runRepoWorkspaceCommand } from './files'
import { shellQuote } from './shell'
import type { RepoWorkspace, RepoWorkspaceCommandResult } from './types'

const DEFAULT_COMMIT_AUTHOR_EMAIL =
  'cursor-maintainer-tool@users.noreply.github.com'
const DEFAULT_COMMIT_AUTHOR_NAME = 'Cursor Maintainer Tool'

export interface RepoWorkspaceGitInspectInput {
  limit?: number
  operation: 'branches' | 'diff' | 'log' | 'show' | 'status'
  path?: string
  ref?: string
  staged?: boolean
}

export async function initializeRepoWorkspaceCheckout(input: {
  repoUrl: string
  workspace: RepoWorkspace
}): Promise<void> {
  if (!(await workspaceHasCheckout(input.workspace))) {
    const cloneResult = await runRepoWorkspaceCommand(
      input.workspace,
      `git clone --depth 1 ${shellQuote(input.repoUrl)} .`
    )
    assertGitCommandSucceeded(cloneResult, 'Git clone failed.')
  }

  await configureGitIdentity(input.workspace)
}

export async function inspectRepoWorkspaceGit(input: {
  value: RepoWorkspaceGitInspectInput
  workspace: RepoWorkspace
}): Promise<{
  command: string
  currentBranch: string
  stderr: string
  stdout: string
}> {
  const currentBranch = await currentRepoWorkspaceBranch(input.workspace)
  const command = inspectionCommand(input.value)
  const result = await runRepoWorkspaceCommand(input.workspace, command)
  assertGitCommandSucceeded(result, `git ${input.value.operation} failed.`)

  return {
    command,
    currentBranch,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  }
}

export async function createRepoWorkspaceBranch(input: {
  baseBranch: string
  branchName: string
  workspace: RepoWorkspace
}): Promise<{
  branchName: string
  currentBranch: string
  stderr: string
  stdout: string
}> {
  await assertValidBranchName(input.workspace, input.branchName)
  await assertValidBranchName(input.workspace, input.baseBranch)

  const command = [
    `git fetch origin ${shellQuote(input.baseBranch)}`,
    `git checkout -B ${shellQuote(input.branchName)} ${shellQuote(
      `origin/${input.baseBranch}`
    )}`,
  ].join(' && ')

  const result = await runRepoWorkspaceCommand(input.workspace, command)
  assertGitCommandSucceeded(result, 'Failed to create the requested branch.')

  return {
    branchName: input.branchName,
    currentBranch: await currentRepoWorkspaceBranch(input.workspace),
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  }
}

export async function commitAndPushRepoWorkspace(input: {
  authorEmail?: string
  authorName?: string
  branchName?: string
  commitMessage: string
  workspace: RepoWorkspace
}): Promise<{
  branchName: string
  commitMessage: string
  stderr: string
  stdout: string
}> {
  const commitMessage = input.commitMessage.trim()
  if (commitMessage.length === 0) {
    throw new RepoWorkspaceInputError(
      'commitMessage must be a non-empty string.'
    )
  }

  const branchName =
    input.branchName?.trim() ||
    (await currentRepoWorkspaceBranch(input.workspace))
  await assertValidBranchName(input.workspace, branchName)

  const status = await runRepoWorkspaceCommand(
    input.workspace,
    'git status --porcelain'
  )
  assertGitCommandSucceeded(status, 'Failed to inspect repository status.')
  if (status.stdout.trim().length === 0) {
    throw new RepoWorkspaceInputError('There are no local changes to commit.')
  }

  const authorName = (input.authorName ?? DEFAULT_COMMIT_AUTHOR_NAME).trim()
  const authorEmail = (input.authorEmail ?? DEFAULT_COMMIT_AUTHOR_EMAIL).trim()
  if (authorName.length === 0 || authorEmail.length === 0) {
    throw new RepoWorkspaceInputError(
      'authorName and authorEmail must be non-empty strings.'
    )
  }

  const command = [
    'git add -A',
    `git -c user.name=${shellQuote(authorName)} -c user.email=${shellQuote(
      authorEmail
    )} commit -m ${shellQuote(commitMessage)}`,
    `git push --set-upstream origin ${shellQuote(branchName)}`,
  ].join(' && ')

  const result = await runRepoWorkspaceCommand(input.workspace, command)
  assertGitCommandSucceeded(
    result,
    'Failed to commit and push the repository changes.'
  )

  return {
    branchName,
    commitMessage,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  }
}

export async function currentRepoWorkspaceBranch(
  workspace: RepoWorkspace
): Promise<string> {
  const result = await runRepoWorkspaceCommand(
    workspace,
    'git rev-parse --abbrev-ref HEAD'
  )
  assertGitCommandSucceeded(result, 'Failed to read the current branch.')
  const branchName = result.stdout.trim()
  if (branchName.length === 0 || branchName === 'HEAD') {
    throw new RepoWorkspaceProviderError(
      'Repository checkout is detached; create or checkout a branch first.'
    )
  }
  return branchName
}

async function configureGitIdentity(workspace: RepoWorkspace): Promise<void> {
  const command = [
    `git config user.name ${shellQuote(DEFAULT_COMMIT_AUTHOR_NAME)}`,
    `git config user.email ${shellQuote(DEFAULT_COMMIT_AUTHOR_EMAIL)}`,
    `git config --local --add safe.directory ${shellQuote(workspace.rootPath)}`,
  ].join(' && ')
  const result = await runRepoWorkspaceCommand(workspace, command)
  assertGitCommandSucceeded(
    result,
    'Failed to configure git identity for the repo workspace.'
  )
}

function inspectionCommand(input: RepoWorkspaceGitInspectInput): string {
  switch (input.operation) {
    case 'status':
      return 'git status --short --branch'
    case 'branches':
      return 'git branch --all --verbose'
    case 'diff': {
      const pathSegment = input.path ? ` -- ${shellQuote(input.path)}` : ''
      return input.staged
        ? `git diff --staged${pathSegment}`
        : `git diff${pathSegment}`
    }
    case 'log': {
      const limit = Math.min(Math.max(input.limit ?? 10, 1), 50)
      return `git log --decorate --oneline -n ${limit}`
    }
    case 'show':
      return `git show --stat ${shellQuote(input.ref?.trim() || 'HEAD')}`
    default: {
      const exhaustive: never = input.operation
      throw new RepoWorkspaceInputError(
        `Unsupported git inspection operation: ${exhaustive}`
      )
    }
  }
}

async function assertValidBranchName(
  workspace: RepoWorkspace,
  branchName: string
): Promise<void> {
  if (branchName.trim().length === 0) {
    throw new RepoWorkspaceInputError('branchName must be a non-empty string.')
  }
  const result = await runRepoWorkspaceCommand(
    workspace,
    `git check-ref-format --branch ${shellQuote(branchName)}`
  )
  if (result.exitCode !== 0) {
    throw new RepoWorkspaceInputError(
      result.stderr.trim() || `Invalid git branch name: ${branchName}`
    )
  }
}

function assertGitCommandSucceeded(
  result: RepoWorkspaceCommandResult,
  fallbackMessage: string
): void {
  if (result.exitCode === 0) {
    return
  }

  const stderr = result.stderr.trim()
  const stdout = result.stdout.trim()
  const details = stderr || stdout
  throw new RepoWorkspaceProviderError(
    details ? `${fallbackMessage} ${details}` : fallbackMessage
  )
}

async function workspaceHasCheckout(
  workspace: RepoWorkspace
): Promise<boolean> {
  const result = await runRepoWorkspaceCommand(workspace, 'test -d .git')
  if (result.exitCode === 0) {
    return true
  }
  if (result.exitCode === 1) {
    return false
  }
  throw new RepoWorkspaceProviderError(
    result.stderr.trim() ||
      'Failed to determine whether the repository is cloned.'
  )
}
