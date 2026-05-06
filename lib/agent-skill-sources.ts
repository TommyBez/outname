import 'server-only'
import { unzipSync } from 'fflate'
import {
  assertValidSkillName,
  extractSkillBody,
  parseSkillFrontmatter,
  renderSkillMd,
} from './agent-skill-parser'
import type { ParsedSkillBundle, ParsedSkillFile } from './agent-skill-types'

const MAX_FILE_BYTES = 1_000_000
const MAX_TOTAL_BYTES = 5_000_000
const MAX_FILES = 200
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: false })

const BACKSLASH_RE = /\\/g
const LEADING_DOT_SLASH_RE = /^\.\//
const LEADING_SLASH_RE = /^\/+/
const TRAILING_GIT_RE = /\.git$/
const LEADING_TRAILING_SLASH_RE = /^\/+|\/+$/g

/**
 * Decode a `Uint8Array` to UTF-8 text. Returns `null` for files that
 * appear to be binary (contain a NUL byte) — those are silently dropped
 * to mirror bash-tool's "skip files that can't be read as text" path.
 */
function decodeText(bytes: Uint8Array): string | null {
  if (bytes.length === 0) {
    return ''
  }
  for (let i = 0; i < Math.min(bytes.length, 4096); i++) {
    if (bytes[i] === 0) {
      return null
    }
  }
  return TEXT_DECODER.decode(bytes)
}

function normalizePath(path: string): string {
  return path
    .replace(BACKSLASH_RE, '/')
    .replace(LEADING_DOT_SLASH_RE, '')
    .replace(LEADING_SLASH_RE, '')
}

function isUnsafePath(path: string): boolean {
  if (path.length === 0) {
    return true
  }
  const parts = path.split('/')
  return parts.some((p) => p === '..' || p === '.')
}

interface ExtractedZipEntry {
  content: string
  executable: boolean
  path: string
}

/**
 * Extract a skill bundle from a zipped directory. The skill root is
 * located by finding `SKILL.md`:
 *
 *   - If the zip's root contains `SKILL.md`, files at the root are the
 *     skill files.
 *   - If a single subdirectory (a wrapper folder, common when zipping
 *     a folder) contains `SKILL.md`, that subdirectory becomes the root
 *     and is unwrapped.
 *   - Multiple `SKILL.md` files at different depths is an error — the
 *     uploader has to be explicit.
 */
export function buildSkillBundleFromZip(input: {
  bytes: Uint8Array
}): ParsedSkillBundle {
  const decoded = unzipSync(input.bytes)
  const entries: ExtractedZipEntry[] = []
  let totalBytes = 0
  for (const [rawPath, value] of Object.entries(decoded)) {
    const path = normalizePath(rawPath)
    if (path === '' || path.endsWith('/')) {
      continue
    }
    if (isUnsafePath(path)) {
      continue
    }
    if (path.includes('__MACOSX/') || path.endsWith('.DS_Store')) {
      continue
    }
    if (value.byteLength > MAX_FILE_BYTES) {
      throw new Error(
        `Zip entry "${path}" exceeds the per-file size limit of ${MAX_FILE_BYTES} bytes.`
      )
    }
    totalBytes += value.byteLength
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error(
        `Zip exceeds the total skill size limit of ${MAX_TOTAL_BYTES} bytes.`
      )
    }
    const text = decodeText(value)
    if (text === null) {
      continue
    }
    entries.push({
      path,
      content: text,
      executable: path.startsWith('scripts/') || path.endsWith('.sh'),
    })
    if (entries.length > MAX_FILES) {
      throw new Error(`Zip exceeds the ${MAX_FILES} file limit.`)
    }
  }

  return resolveBundleRoot(entries)
}

function resolveBundleRoot(entries: ExtractedZipEntry[]): ParsedSkillBundle {
  const skillMdEntries = entries.filter((e) => {
    const segments = e.path.split('/')
    return segments.at(-1) === 'SKILL.md'
  })
  if (skillMdEntries.length === 0) {
    throw new Error('Zip does not contain a SKILL.md file.')
  }
  if (skillMdEntries.length > 1) {
    const paths = skillMdEntries.map((e) => e.path).join(', ')
    throw new Error(
      `Zip contains multiple SKILL.md files (${paths}). Upload a single skill at a time.`
    )
  }
  const skillMd = skillMdEntries[0]
  const rootSegments = skillMd.path.split('/')
  rootSegments.pop()
  const rootPrefix = rootSegments.join('/')
  const prefix = rootPrefix === '' ? '' : `${rootPrefix}/`

  const metadata = parseSkillFrontmatter(skillMd.content)
  if (!metadata) {
    throw new Error(
      'SKILL.md is missing required frontmatter. Add `name` and `description` between `---` fences.'
    )
  }
  assertValidSkillName(metadata.name)

  const files: ParsedSkillFile[] = []
  for (const entry of entries) {
    if (prefix !== '' && !entry.path.startsWith(prefix)) {
      continue
    }
    const relPath = entry.path.slice(prefix.length)
    if (relPath === '' || isUnsafePath(relPath)) {
      continue
    }
    if (relPath === 'SKILL.md') {
      files.push({
        path: 'SKILL.md',
        content: renderSkillMd(metadata, extractSkillBody(entry.content)),
        executable: false,
      })
    } else {
      files.push({
        path: relPath,
        content: entry.content,
        executable: entry.executable,
      })
    }
  }

  return { metadata, files }
}

/**
 * Resolve a GitHub source — `owner/repo`, `owner/repo/path/to/skill`,
 * or a `https://github.com/owner/repo[/tree/<ref>]/path/to/skill` URL —
 * into a skill bundle. The ref defaults to the repo's default branch
 * unless an explicit `@ref` or `tree/<ref>` is provided.
 */
export async function buildSkillBundleFromGithub(input: {
  source: string
}): Promise<{ bundle: ParsedSkillBundle; resolvedRef: string }> {
  const parsed = parseGithubSource(input.source)
  const ref =
    parsed.ref ?? (await fetchDefaultBranch(parsed.owner, parsed.repo))

  const apiPath = parsed.path
    ? `repos/${parsed.owner}/${parsed.repo}/contents/${encodePath(parsed.path)}?ref=${encodeURIComponent(ref)}`
    : `repos/${parsed.owner}/${parsed.repo}/contents?ref=${encodeURIComponent(ref)}`

  const root = await githubGet(apiPath)
  const skillRoot = await locateSkillRoot({
    owner: parsed.owner,
    repo: parsed.repo,
    ref,
    initialPath: parsed.path ?? '',
    initialEntries: root,
  })

  const files = await collectSkillFiles({
    owner: parsed.owner,
    repo: parsed.repo,
    ref,
    rootPath: skillRoot.path,
  })

  const skillMd = files.find((f) => f.path === 'SKILL.md')
  if (!skillMd) {
    throw new Error(
      `GitHub path ${parsed.owner}/${parsed.repo}/${skillRoot.path} has no SKILL.md.`
    )
  }
  const metadata = parseSkillFrontmatter(skillMd.content)
  if (!metadata) {
    throw new Error(
      'GitHub SKILL.md is missing required frontmatter (`name`, `description`).'
    )
  }
  assertValidSkillName(metadata.name)

  const canonicalFiles: ParsedSkillFile[] = files.map((f) => {
    if (f.path === 'SKILL.md') {
      return {
        path: 'SKILL.md',
        content: renderSkillMd(metadata, extractSkillBody(f.content)),
        executable: false,
      }
    }
    return f
  })

  return {
    bundle: { metadata, files: canonicalFiles },
    resolvedRef: ref,
  }
}

interface GithubContentEntry {
  download_url: string | null
  name: string
  path: string
  size?: number
  type: 'file' | 'dir' | 'symlink' | 'submodule'
}

async function fetchDefaultBranch(
  owner: string,
  repo: string
): Promise<string> {
  const data = (await githubGet(`repos/${owner}/${repo}`)) as {
    default_branch?: string
  }
  return data.default_branch ?? 'main'
}

async function githubGet(path: string): Promise<unknown> {
  const url = `https://api.github.com/${path}`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'personal-assistant-agent-skills',
  }
  const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_API_TOKEN
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `GitHub API ${res.status} for ${path}: ${body.slice(0, 200)}`
    )
  }
  return res.json()
}

async function locateSkillRoot(input: {
  owner: string
  repo: string
  ref: string
  initialPath: string
  initialEntries: unknown
}): Promise<{ path: string }> {
  const entries = ensureContentArray(input.initialEntries)
  const skillMd = entries.find(
    (e) => e.type === 'file' && e.name === 'SKILL.md'
  )
  if (skillMd) {
    return { path: input.initialPath }
  }
  const dirs = entries.filter((e) => e.type === 'dir')
  if (dirs.length === 1) {
    const child = dirs[0]
    const childEntries = (await githubGet(
      `repos/${input.owner}/${input.repo}/contents/${encodePath(child.path)}?ref=${encodeURIComponent(input.ref)}`
    )) as unknown
    return await locateSkillRoot({
      ...input,
      initialPath: child.path,
      initialEntries: childEntries,
    })
  }
  throw new Error(
    `Could not find SKILL.md at ${input.owner}/${input.repo}/${input.initialPath || '<root>'} (ref ${input.ref}).`
  )
}

async function collectSkillFiles(input: {
  owner: string
  repo: string
  ref: string
  rootPath: string
}): Promise<ParsedSkillFile[]> {
  const files: ParsedSkillFile[] = []
  const counter = { totalBytes: 0 }
  const queue: string[] = [input.rootPath]
  while (queue.length > 0) {
    const current = queue.shift() as string
    const apiPath = current
      ? `repos/${input.owner}/${input.repo}/contents/${encodePath(current)}?ref=${encodeURIComponent(input.ref)}`
      : `repos/${input.owner}/${input.repo}/contents?ref=${encodeURIComponent(input.ref)}`
    const entries = ensureContentArray(await githubGet(apiPath))
    for (const entry of entries) {
      await ingestGithubEntry({
        entry,
        rootPath: input.rootPath,
        files,
        counter,
        queue,
      })
    }
  }
  return files
}

async function ingestGithubEntry(input: {
  entry: GithubContentEntry
  rootPath: string
  files: ParsedSkillFile[]
  counter: { totalBytes: number }
  queue: string[]
}): Promise<void> {
  const { entry, rootPath, files, counter, queue } = input
  if (entry.type === 'dir') {
    queue.push(entry.path)
    return
  }
  if (entry.type !== 'file' || !entry.download_url) {
    return
  }
  const size = entry.size ?? 0
  if (size > MAX_FILE_BYTES) {
    return
  }
  counter.totalBytes += size
  if (counter.totalBytes > MAX_TOTAL_BYTES) {
    throw new Error(
      `GitHub skill exceeds the ${MAX_TOTAL_BYTES} byte total size limit.`
    )
  }
  const res = await fetch(entry.download_url)
  if (!res.ok) {
    return
  }
  const text = decodeText(new Uint8Array(await res.arrayBuffer()))
  if (text === null) {
    return
  }
  const relPath = entry.path.slice(rootPath ? rootPath.length + 1 : 0)
  if (relPath === '' || isUnsafePath(relPath)) {
    return
  }
  files.push({
    path: relPath,
    content: text,
    executable: relPath.startsWith('scripts/') || relPath.endsWith('.sh'),
  })
  if (files.length > MAX_FILES) {
    throw new Error(`GitHub skill exceeds the ${MAX_FILES} file limit.`)
  }
}

function ensureContentArray(data: unknown): GithubContentEntry[] {
  if (Array.isArray(data)) {
    return data as GithubContentEntry[]
  }
  if (data && typeof data === 'object') {
    return [data as GithubContentEntry]
  }
  return []
}

function encodePath(path: string): string {
  return path
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => encodeURIComponent(s))
    .join('/')
}

interface ParsedGithubSource {
  owner: string
  path: string | null
  ref: string | null
  repo: string
}

export function parseGithubSource(input: string): ParsedGithubSource {
  let working = input.trim()
  let ref: string | null = null
  if (working.includes('@')) {
    const at = working.lastIndexOf('@')
    if (at > working.lastIndexOf('/')) {
      ref = working.slice(at + 1) || null
      working = working.slice(0, at)
    }
  }

  if (working.startsWith('http://') || working.startsWith('https://')) {
    const url = new URL(working)
    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
      throw new Error(
        `Unsupported host "${url.hostname}". Only github.com URLs are accepted.`
      )
    }
    const segments = url.pathname
      .replace(LEADING_TRAILING_SLASH_RE, '')
      .split('/')
    if (segments.length < 2) {
      throw new Error('GitHub URL must include both owner and repo.')
    }
    const [owner, repoMaybe, ...rest] = segments
    const repo = repoMaybe.replace(TRAILING_GIT_RE, '')
    if (rest[0] === 'tree' || rest[0] === 'blob') {
      const refFromUrl = rest[1]
      const subPath = rest.slice(2).join('/')
      return {
        owner,
        repo,
        path: subPath || null,
        ref: ref ?? refFromUrl ?? null,
      }
    }
    return {
      owner,
      repo,
      path: rest.length > 0 ? rest.join('/') : null,
      ref,
    }
  }

  // Plain `owner/repo[/path]`.
  const segments = working
    .replace(LEADING_TRAILING_SLASH_RE, '')
    .split('/')
    .filter((s) => s.length > 0)
  if (segments.length < 2) {
    throw new Error(
      'GitHub source must be `owner/repo` or `owner/repo/path/to/skill`.'
    )
  }
  const [owner, repoMaybe, ...rest] = segments
  const repo = repoMaybe.replace(TRAILING_GIT_RE, '')
  return {
    owner,
    repo,
    path: rest.length > 0 ? rest.join('/') : null,
    ref,
  }
}
