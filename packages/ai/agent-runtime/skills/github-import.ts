import { type PreparedSkillPackage, prepareGitHubSkillZip } from './package'

const GITHUB_HOSTNAME = 'github.com'
const GITHUB_CODELOAD_HOSTNAME = 'codeload.github.com'
const GITHUB_API_HOSTNAME = 'api.github.com'
const MAX_GITHUB_ARCHIVE_BYTES = 25 * 1024 * 1024

export interface GitHubSkillSource {
  isSkillMdFile: boolean
  originalUrl: string
  owner: string
  path: string
  ref: string
  repo: string
}

export interface GitHubSkillImportResult {
  package: PreparedSkillPackage
  source: GitHubSkillSource
}

export class GitHubSkillImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitHubSkillImportError'
  }
}

export function parseGitHubSkillUrl(url: string): GitHubSkillSource {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new GitHubSkillImportError('Enter a valid GitHub URL.')
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== GITHUB_HOSTNAME) {
    throw new GitHubSkillImportError(
      'Only public https://github.com URLs are supported.'
    )
  }
  if (parsed.username || parsed.password) {
    throw new GitHubSkillImportError(
      'Credentialed GitHub URLs are not supported.'
    )
  }

  const segments = parsed.pathname
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .filter(Boolean)
  const [owner, repo, kind, ...rest] = segments
  if (!(owner && repo)) {
    throw new GitHubSkillImportError(
      'GitHub URL must include an owner and repository.'
    )
  }

  if (!kind) {
    return {
      isSkillMdFile: false,
      originalUrl: url,
      owner,
      path: '',
      ref: 'HEAD',
      repo: stripGitSuffix(repo),
    }
  }

  if (kind !== 'tree' && kind !== 'blob') {
    throw new GitHubSkillImportError(
      'Use a GitHub repository, directory, or SKILL.md file URL.'
    )
  }
  if (rest.length === 0) {
    throw new GitHubSkillImportError(
      'GitHub tree/blob URLs must include a ref.'
    )
  }

  const [ref, ...pathSegments] = rest
  const path = pathSegments.join('/')
  if (kind === 'blob') {
    if (!path.endsWith('SKILL.md')) {
      throw new GitHubSkillImportError(
        'GitHub file URLs must point to a SKILL.md file.'
      )
    }
    return {
      isSkillMdFile: true,
      originalUrl: url,
      owner,
      path: parentPath(path),
      ref,
      repo: stripGitSuffix(repo),
    }
  }

  return {
    isSkillMdFile: false,
    originalUrl: url,
    owner,
    path,
    ref,
    repo: stripGitSuffix(repo),
  }
}

export async function importGitHubSkill(
  url: string
): Promise<GitHubSkillImportResult> {
  const parsed = parseGitHubSkillUrl(url)
  const ref =
    parsed.ref === 'HEAD'
      ? await resolveDefaultBranch(parsed.owner, parsed.repo)
      : parsed.ref
  const source = { ...parsed, ref }
  const content = await downloadGitHubArchive({
    owner: source.owner,
    ref: source.ref,
    repo: source.repo,
  })

  return {
    package: await prepareGitHubSkillZip({
      content,
      sourcePath: source.path,
    }),
    source,
  }
}

async function resolveDefaultBranch(
  owner: string,
  repo: string
): Promise<string> {
  const response = await fetch(
    `https://${GITHUB_API_HOSTNAME}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'outname-agent-skills',
      },
    }
  )
  if (!response.ok) {
    throw new GitHubSkillImportError(
      `Could not resolve the repository default branch (${response.status}).`
    )
  }
  const body = (await response.json().catch(() => null)) as {
    default_branch?: unknown
  } | null
  if (typeof body?.default_branch !== 'string' || !body.default_branch.trim()) {
    throw new GitHubSkillImportError(
      'Could not resolve the repository default branch.'
    )
  }
  return body.default_branch.trim()
}

async function downloadGitHubArchive(input: {
  owner: string
  ref: string
  repo: string
}): Promise<Buffer> {
  const url = `https://${GITHUB_CODELOAD_HOSTNAME}/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/zip/${encodeURIComponent(input.ref)}`
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/zip',
      'User-Agent': 'outname-agent-skills',
    },
  })
  if (!response.ok) {
    throw new GitHubSkillImportError(
      'Could not download the GitHub archive. If the branch name contains slashes, open the skill directory or SKILL.md in GitHub and copy that URL.'
    )
  }
  return await readLimitedResponse(response, MAX_GITHUB_ARCHIVE_BYTES)
}

async function readLimitedResponse(
  response: Response,
  limitBytes: number
): Promise<Buffer> {
  const contentLength = response.headers.get('content-length')
  if (contentLength && Number(contentLength) > limitBytes) {
    throw new GitHubSkillImportError(
      `GitHub archive is too large (max ${limitBytes} bytes).`
    )
  }
  if (!response.body) {
    return Buffer.from(await response.arrayBuffer())
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    if (!value) {
      continue
    }
    total += value.byteLength
    if (total > limitBytes) {
      throw new GitHubSkillImportError(
        `GitHub archive is too large (max ${limitBytes} bytes).`
      )
    }
    chunks.push(value)
  }

  return Buffer.concat(chunks)
}

function parentPath(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

function stripGitSuffix(repo: string): string {
  return repo.endsWith('.git') ? repo.slice(0, -4) : repo
}
