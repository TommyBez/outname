import path from 'node:path'
import type { Sandbox } from '@vercel/sandbox'
import { type Tool, tool } from 'ai'
import { z } from 'zod'

const SKILLS_ROOT = '/workspace/agent-skills'
const MAX_SKILL_MD_BYTES = 512_000

const SKILL_FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?/
const FRONTMATTER_FIELD_REGEX = /^(name|description):\s*(.+)$/m
const HEADING_REGEX = /^#\s+(.+)$/m
const NAME_FIELD_REGEX = /(^|\n)name:\s*(.+)/
const DOT_SLASH_PREFIX_REGEX = /^\.\//
const LEADING_SLASH_REGEX = /^\//

export interface SandboxSkillMetadata {
  description: string
  files: string[]
  name: string
  sandboxPath: string
  slug: string
}

export interface IngestMarkdownSkillInput {
  markdown: string
  slug?: string
}

export interface IngestZipSkillInput {
  filename?: string
  zipBase64: string
}

export interface IngestGithubSkillInput {
  branch?: string
  repoUrl: string
}

function normalizeSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!normalized) {
    throw new Error('Skill slug cannot be empty after normalization')
  }
  return normalized
}

function extractMarkdownMetadata(markdown: string): {
  description: string
  name: string
} {
  const headerMatch = markdown.match(SKILL_FRONTMATTER_REGEX)
  const header = headerMatch?.[1] ?? ''
  const nameMatch = header.match(NAME_FIELD_REGEX)
  const descriptionMatch = header.match(FRONTMATTER_FIELD_REGEX)

  const headingMatch = markdown.match(HEADING_REGEX)
  const name = (nameMatch?.[2] ?? headingMatch?.[1] ?? 'unnamed-skill').trim()
  const description = (descriptionMatch?.[2] ?? 'User-provided skill').trim()

  if (Buffer.byteLength(markdown, 'utf8') > MAX_SKILL_MD_BYTES) {
    throw new Error('SKILL.md exceeds maximum allowed size')
  }

  return { name, description }
}

async function ensureDir(sandbox: Sandbox, dirPath: string): Promise<void> {
  await sandbox.runCommand('bash', [
    '-lc',
    `mkdir -p ${JSON.stringify(dirPath)}`,
  ])
}

async function listFilesRecursive(
  sandbox: Sandbox,
  root: string
): Promise<string[]> {
  const result = await sandbox.runCommand('bash', [
    '-lc',
    `cd ${JSON.stringify(root)} && find . -type f | sort`,
  ])
  const stdout = await result.stdout()
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(DOT_SLASH_PREFIX_REGEX, ''))
}

async function readUtf8File(
  sandbox: Sandbox,
  filePath: string
): Promise<string> {
  const buffer = await sandbox.readFileToBuffer({ path: filePath })
  if (!buffer) {
    throw new Error(`File not found: ${filePath}`)
  }
  return buffer.toString('utf8')
}

export async function ingestMarkdownSkill(
  sandbox: Sandbox,
  input: IngestMarkdownSkillInput
): Promise<SandboxSkillMetadata> {
  const { markdown } = input
  const metadata = extractMarkdownMetadata(markdown)
  const slug = normalizeSlug(input.slug ?? metadata.name)
  const skillDir = path.posix.join(SKILLS_ROOT, slug)

  await ensureDir(sandbox, skillDir)
  await sandbox.writeFiles([
    {
      path: path.posix.join(skillDir, 'SKILL.md'),
      content: Buffer.from(markdown, 'utf8'),
    },
  ])

  return {
    ...metadata,
    files: ['SKILL.md'],
    sandboxPath: skillDir,
    slug,
  }
}

async function validateZipEntries(
  sandbox: Sandbox,
  zipPath: string
): Promise<void> {
  const result = await sandbox.runCommand('bash', [
    '-lc',
    `unzip -Z1 ${JSON.stringify(zipPath)}`,
  ])
  const stdout = await result.stdout()
  const entries = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const entry of entries) {
    if (entry.startsWith('/') || entry.includes('..')) {
      throw new Error(`Unsafe ZIP entry rejected: ${entry}`)
    }
  }
}

export async function ingestZipSkill(
  sandbox: Sandbox,
  input: IngestZipSkillInput
): Promise<SandboxSkillMetadata> {
  const slug = normalizeSlug(
    input.filename ?? `uploaded-${Date.now().toString(36)}`
  )
  const stagingDir = path.posix.join(SKILLS_ROOT, '.staging', slug)
  const zipPath = path.posix.join(stagingDir, 'skill.zip')

  await ensureDir(sandbox, stagingDir)
  await sandbox.writeFiles([
    { path: zipPath, content: Buffer.from(input.zipBase64, 'base64') },
  ])

  await validateZipEntries(sandbox, zipPath)

  const extractDir = path.posix.join(stagingDir, 'extract')
  await ensureDir(sandbox, extractDir)
  await sandbox.runCommand('bash', [
    '-lc',
    `unzip -qq ${JSON.stringify(zipPath)} -d ${JSON.stringify(extractDir)}`,
  ])

  const extractedFiles = await listFilesRecursive(sandbox, extractDir)
  const skillMdRelative = extractedFiles.find((file) =>
    file.endsWith('SKILL.md')
  )
  if (!skillMdRelative) {
    throw new Error('ZIP skill is missing SKILL.md')
  }

  const skillMarkdown = await readUtf8File(
    sandbox,
    path.posix.join(extractDir, skillMdRelative)
  )
  const metadata = extractMarkdownMetadata(skillMarkdown)
  const finalSlug = normalizeSlug(metadata.name)
  const finalDir = path.posix.join(SKILLS_ROOT, finalSlug)
  await ensureDir(sandbox, finalDir)
  await sandbox.runCommand('bash', [
    '-lc',
    `cp -R ${JSON.stringify(path.posix.dirname(path.posix.join(extractDir, skillMdRelative)))}/. ${JSON.stringify(finalDir)}`,
  ])

  return {
    ...metadata,
    files: await listFilesRecursive(sandbox, finalDir),
    sandboxPath: finalDir,
    slug: finalSlug,
  }
}

export async function ingestGithubSkill(
  sandbox: Sandbox,
  input: IngestGithubSkillInput
): Promise<SandboxSkillMetadata> {
  const url = new URL(input.repoUrl)
  const [owner, repo] = url.pathname.replace(LEADING_SLASH_REGEX, '').split('/')
  if (!(owner && repo)) {
    throw new Error('Invalid GitHub repository URL')
  }

  const branch = input.branch ?? 'main'
  const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`
  const response = await fetch(zipUrl)
  if (!response.ok) {
    throw new Error(
      `Failed to download GitHub repository ZIP: ${response.status}`
    )
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  return await ingestZipSkill(sandbox, {
    filename: `${owner}-${repo}-${branch}`,
    zipBase64: bytes.toString('base64'),
  })
}

export async function listSandboxSkills(
  sandbox: Sandbox
): Promise<SandboxSkillMetadata[]> {
  await ensureDir(sandbox, SKILLS_ROOT)
  const dirsResult = await sandbox.runCommand('bash', [
    '-lc',
    `cd ${JSON.stringify(SKILLS_ROOT)} && find . -mindepth 1 -maxdepth 1 -type d | sort`,
  ])
  const dirsOut = await dirsResult.stdout()
  const dirs = dirsOut
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('./.staging'))
    .map((line) => line.replace(DOT_SLASH_PREFIX_REGEX, ''))

  const skills: SandboxSkillMetadata[] = []
  for (const dir of dirs) {
    const skillDir = path.posix.join(SKILLS_ROOT, dir)
    const skillMdPath = path.posix.join(skillDir, 'SKILL.md')
    try {
      const markdown = await readUtf8File(sandbox, skillMdPath)
      const metadata = extractMarkdownMetadata(markdown)
      skills.push({
        ...metadata,
        files: await listFilesRecursive(sandbox, skillDir),
        sandboxPath: skillDir,
        slug: dir,
      })
    } catch {
      // Ignore malformed skill directories.
    }
  }
  return skills
}

export function createSandboxSkillTool(options: {
  sandbox: Sandbox
  skills: SandboxSkillMetadata[]
}): Tool {
  const skillMap = new Map(options.skills.map((skill) => [skill.name, skill]))

  return tool({
    description: [
      'Load instructions from a sandbox-backed skill directory.',
      'Skills are user-provided and stored in Vercel Sandbox filesystem.',
      '',
      'Available skills:',
      ...options.skills.map((skill) => `- ${skill.name}: ${skill.description}`),
    ].join('\n'),
    inputSchema: z.object({
      skillName: z.string().min(1),
    }),
    execute: async ({ skillName }) => {
      const skill = skillMap.get(skillName)
      if (!skill) {
        return { success: false, error: `Skill not found: ${skillName}` }
      }
      const content = await readUtf8File(
        options.sandbox,
        path.posix.join(skill.sandboxPath, 'SKILL.md')
      )
      return {
        success: true,
        skill: {
          description: skill.description,
          name: skill.name,
          path: skill.sandboxPath,
        },
        instructions: content,
        files: skill.files.filter((file) => file !== 'SKILL.md'),
      }
    },
  })
}
