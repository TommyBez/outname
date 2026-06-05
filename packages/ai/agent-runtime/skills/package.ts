import { createHash } from 'node:crypto'
import yauzl from 'yauzl'
import { parseSkillMd } from './skill-md'

const MAX_PACKAGE_BYTES = 25 * 1024 * 1024
const MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024
const MAX_SKILL_MD_BYTES = 256 * 1024
const MAX_FILE_COUNT = 200
const MAX_PATH_CHARS = 512
const ZIP_MADE_BY_PLATFORM_DIVISOR = 256
const ZIP_UNIX_PLATFORM = 3
const ZIP_EXTERNAL_ATTRIBUTES_MODE_DIVISOR = 65_536
const UNIX_FILE_TYPE_BLOCK = 0o1_0000
const UNIX_REGULAR_FILE_TYPE = 0o10_0000
const UNIX_EXECUTABLE_BITS = [0o100, 0o010, 0o001] as const
const SKILL_MD_PATH = 'SKILL.md'
const NUL_PATTERN = /\0/
const LEADING_SLASHES_PATTERN = /^\/+/
const TRAILING_SLASHES_PATTERN = /\/+$/

export interface SkillPackageFile {
  content: Buffer
  executable: boolean
  path: string
}

export interface PreparedSkillPackage {
  contentHash: string
  description: string
  fileCount: number
  files: SkillPackageFile[]
  instructions: string
  name: string
  nameNormalized: string
  skillMdPath: string
  totalBytes: number
}

export class SkillPackageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillPackageError'
  }
}

interface RawZipFile {
  content: Buffer
  executable: boolean
  path: string
}

export function prepareSkillMdUpload(input: {
  content: Buffer
}): PreparedSkillPackage {
  return prepareSkillPackage([
    { content: input.content, executable: false, path: SKILL_MD_PATH },
  ])
}

export async function prepareSkillZipUpload(input: {
  content: Buffer
}): Promise<PreparedSkillPackage> {
  const files = await readZipFiles(input.content)
  return prepareSkillPackage(normalizeZipSkillRoot(files))
}

export async function prepareGitHubSkillZip(input: {
  content: Buffer
  sourcePath: string
}): Promise<PreparedSkillPackage> {
  const files = await readZipFiles(input.content)
  const strippedArchiveRoot = stripArchiveRoot(files)
  const sourcePrefix = normalizeSourcePath(input.sourcePath)
  const scoped = sourcePrefix
    ? strippedArchiveRoot
        .filter((file) => pathMatchesPrefix(file.path, sourcePrefix))
        .map((file) => ({
          ...file,
          path:
            file.path === sourcePrefix
              ? ''
              : file.path.slice(sourcePrefix.length + 1),
        }))
        .filter((file) => file.path.length > 0)
    : strippedArchiveRoot
  return prepareSkillPackage(scoped)
}

function prepareSkillPackage(files: SkillPackageFile[]): PreparedSkillPackage {
  const normalizedFiles = normalizePackageFiles(files)
  const skillMd = normalizedFiles.find((file) => file.path === SKILL_MD_PATH)
  if (!skillMd) {
    throw new SkillPackageError('Skill package must contain SKILL.md at root.')
  }
  if (skillMd.content.byteLength > MAX_SKILL_MD_BYTES) {
    throw new SkillPackageError(
      `SKILL.md is too large (max ${MAX_SKILL_MD_BYTES} bytes).`
    )
  }

  const parsed = parseSkillMd(skillMd.content.toString('utf8'))
  const totalBytes = normalizedFiles.reduce(
    (sum, file) => sum + file.content.byteLength,
    0
  )

  return {
    contentHash: hashSkillPackage(normalizedFiles),
    description: parsed.description,
    fileCount: normalizedFiles.length,
    files: normalizedFiles,
    instructions: parsed.instructions,
    name: parsed.name,
    nameNormalized: parsed.nameNormalized,
    skillMdPath: SKILL_MD_PATH,
    totalBytes,
  }
}

function normalizePackageFiles(files: SkillPackageFile[]): SkillPackageFile[] {
  if (files.length === 0) {
    throw new SkillPackageError('Skill package is empty.')
  }
  if (files.length > MAX_FILE_COUNT) {
    throw new SkillPackageError(
      `Skill package has too many files (max ${MAX_FILE_COUNT}).`
    )
  }

  const normalized: SkillPackageFile[] = []
  const seen = new Set<string>()
  let totalBytes = 0

  for (const file of files) {
    const path = normalizePackagePath(file.path)
    if (seen.has(path)) {
      throw new SkillPackageError(`Duplicate file in skill package: ${path}`)
    }
    seen.add(path)
    if (file.content.byteLength > MAX_SINGLE_FILE_BYTES) {
      throw new SkillPackageError(
        `${path} is too large (max ${MAX_SINGLE_FILE_BYTES} bytes).`
      )
    }
    totalBytes += file.content.byteLength
    if (totalBytes > MAX_PACKAGE_BYTES) {
      throw new SkillPackageError(
        `Skill package is too large (max ${MAX_PACKAGE_BYTES} bytes).`
      )
    }
    normalized.push({
      content: file.content,
      executable: file.executable,
      path,
    })
  }

  return normalized.sort((a, b) => a.path.localeCompare(b.path))
}

function normalizeZipSkillRoot(files: RawZipFile[]): SkillPackageFile[] {
  if (files.some((file) => file.path === SKILL_MD_PATH)) {
    return files
  }

  const firstSegments = new Set(
    files
      .map((file) => file.path.split('/')[0])
      .filter((segment) => segment.length > 0)
  )
  if (firstSegments.size !== 1) {
    throw new SkillPackageError(
      'Zip must contain one skill at root or one enclosing directory.'
    )
  }

  const [root] = Array.from(firstSegments)
  const prefix = `${root}/`
  const stripped = files
    .filter((file) => file.path.startsWith(prefix))
    .map((file) => ({ ...file, path: file.path.slice(prefix.length) }))
    .filter((file) => file.path.length > 0)

  if (!stripped.some((file) => file.path === SKILL_MD_PATH)) {
    throw new SkillPackageError(
      'Zip must contain SKILL.md at root or inside its single enclosing directory.'
    )
  }
  return stripped
}

function stripArchiveRoot(files: RawZipFile[]): RawZipFile[] {
  return files
    .map((file) => {
      const segments = file.path.split('/')
      return { ...file, path: segments.slice(1).join('/') }
    })
    .filter((file) => file.path.length > 0)
}

async function readZipFiles(content: Buffer): Promise<RawZipFile[]> {
  if (content.byteLength > MAX_PACKAGE_BYTES) {
    throw new SkillPackageError(
      `Zip is too large (max ${MAX_PACKAGE_BYTES} bytes).`
    )
  }

  const zip = await openZip(content)
  return await new Promise((resolve, reject) => {
    const files: RawZipFile[] = []
    let finished = false

    const fail = (error: unknown) => {
      if (finished) {
        return
      }
      finished = true
      zip.close()
      reject(toSkillPackageError(error))
    }

    zip.on('entry', (entry: yauzl.Entry) => {
      if (finished) {
        return
      }
      const rawPath = entry.fileName
      if (rawPath.endsWith('/')) {
        zip.readEntry()
        return
      }

      let safePath: string
      try {
        safePath = normalizePackagePath(rawPath)
        assertRegularZipEntry(entry, safePath)
      } catch (error) {
        fail(error)
        return
      }

      zip.openReadStream(entry, (streamError, stream) => {
        if (streamError || !stream) {
          fail(
            streamError ?? new SkillPackageError(`Could not read ${safePath}`)
          )
          return
        }

        const chunks: Buffer[] = []
        let bytes = 0
        stream.on('data', (chunk: Buffer) => {
          bytes += chunk.byteLength
          if (bytes > MAX_SINGLE_FILE_BYTES) {
            stream.destroy(
              new SkillPackageError(
                `${safePath} is too large (max ${MAX_SINGLE_FILE_BYTES} bytes).`
              )
            )
            return
          }
          chunks.push(chunk)
        })
        stream.on('error', fail)
        stream.on('end', () => {
          files.push({
            content: Buffer.concat(chunks),
            executable: zipEntryIsExecutable(entry),
            path: safePath,
          })
          if (files.length > MAX_FILE_COUNT) {
            fail(
              new SkillPackageError(
                `Skill package has too many files (max ${MAX_FILE_COUNT}).`
              )
            )
            return
          }
          zip.readEntry()
        })
      })
    })

    zip.on('error', fail)
    zip.on('end', () => {
      if (!finished) {
        finished = true
        resolve(files)
      }
    })
    zip.readEntry()
  })
}

function toSkillPackageError(error: unknown): SkillPackageError {
  if (error instanceof SkillPackageError) {
    return error
  }
  return new SkillPackageError(
    error instanceof Error ? error.message : 'Could not read zip.'
  )
}

function openZip(content: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(content, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) {
        reject(
          new SkillPackageError(
            error instanceof Error ? error.message : 'Could not open zip.'
          )
        )
        return
      }
      resolve(zip)
    })
  })
}

function assertRegularZipEntry(entry: yauzl.Entry, path: string): void {
  const mode = zipEntryMode(entry)
  if (mode === null) {
    return
  }
  const fileType =
    Math.floor(mode / UNIX_FILE_TYPE_BLOCK) * UNIX_FILE_TYPE_BLOCK
  if (fileType !== 0 && fileType !== UNIX_REGULAR_FILE_TYPE) {
    throw new SkillPackageError(`Unsupported zip entry type: ${path}`)
  }
}

function zipEntryIsExecutable(entry: yauzl.Entry): boolean {
  const mode = zipEntryMode(entry)
  return (
    mode !== null &&
    UNIX_EXECUTABLE_BITS.some((bit) => Math.floor(mode / bit) % 2 === 1)
  )
}

function zipEntryMode(entry: yauzl.Entry): number | null {
  const madeByUnix =
    Math.floor(entry.versionMadeBy / ZIP_MADE_BY_PLATFORM_DIVISOR) ===
    ZIP_UNIX_PLATFORM
  if (!madeByUnix) {
    return null
  }
  return Math.floor(
    entry.externalFileAttributes / ZIP_EXTERNAL_ATTRIBUTES_MODE_DIVISOR
  )
}

function normalizePackagePath(rawPath: string): string {
  if (!rawPath || NUL_PATTERN.test(rawPath)) {
    throw new SkillPackageError('Skill package contains an invalid file path.')
  }
  if (rawPath.length > MAX_PATH_CHARS) {
    throw new SkillPackageError(
      `Skill package path is too long (max ${MAX_PATH_CHARS} characters).`
    )
  }
  if (rawPath.startsWith('/')) {
    throw new SkillPackageError(
      `Skill package path must be relative: ${rawPath}`
    )
  }

  const segments: string[] = []
  for (const segment of rawPath.split('/')) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      throw new SkillPackageError(
        `Skill package path may not escape its root: ${rawPath}`
      )
    }
    segments.push(segment)
  }

  const normalized = segments.join('/')
  if (!normalized) {
    throw new SkillPackageError('Skill package contains an empty file path.')
  }
  return normalized
}

function normalizeSourcePath(path: string): string {
  return path
    .replace(LEADING_SLASHES_PATTERN, '')
    .replace(TRAILING_SLASHES_PATTERN, '')
}

function pathMatchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

function hashSkillPackage(files: SkillPackageFile[]): string {
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file.path)
    hash.update('\0')
    hash.update(file.executable ? '1' : '0')
    hash.update('\0')
    hash.update(file.content)
    hash.update('\0')
  }
  return hash.digest('hex')
}
