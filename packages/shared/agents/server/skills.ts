import 'server-only'

import {
  ensureSkillSandbox,
  getSkillSandbox,
} from '@outname/ai/agent-runtime/server/agent-skill-sandbox'
import { importGitHubSkill } from '@outname/ai/agent-runtime/skills/github-import'
import {
  type PreparedSkillPackage,
  prepareSkillMdUpload,
  prepareSkillZipUpload,
  type SkillPackageFile,
} from '@outname/ai/agent-runtime/skills/package'
import { SKILL_PACKAGES_DIR } from '@outname/ai/agent-runtime/skills/paths'
import { importSkillsShSkill } from '@outname/ai/agent-runtime/skills/skills-sh-import'
import {
  slugFromSkillName,
  uniqueSkillSlug,
} from '@outname/ai/agent-runtime/skills/slug'
import { db } from '@outname/db'
import {
  type AgentSkill,
  type AgentSkillSourceType,
  agent,
  agentSkills,
} from '@outname/db/schema'
import { sendAppRevalidation } from '@outname/shared/server/app-revalidation-client'
import {
  agentSkillsTag,
  agentTag,
  userAgentsTag,
} from '@outname/shared/server/cache-tags'
import type { Sandbox } from '@vercel/sandbox'
import { and, eq } from 'drizzle-orm'

const SKILL_MD_PATH = 'SKILL.md'

export type SkillInstallSource =
  | { content: Buffer; type: 'skill_md' }
  | { content: Buffer; type: 'zip' }
  | { type: 'github'; url: string }
  | { id: string; type: 'skills_sh' }

export interface InstalledSkillView {
  contentHash: string
  createdAt: string
  description: string
  fileCount: number
  name: string
  slug: string
  sourcePath: string | null
  sourceRef: string | null
  sourceType: AgentSkillSourceType
  sourceUrl: string | null
  totalBytes: number
  updatedAt: string
}

export interface SkillConflict {
  existing: Pick<InstalledSkillView, 'description' | 'name' | 'slug'>
  incoming: {
    description: string
    name: string
  }
}

export type SkillInstallErrorCode =
  | 'agent_not_found'
  | 'catalog_fetch_failed'
  | 'github_fetch_failed'
  | 'invalid_package'
  | 'name_conflict'
  | 'sandbox_unavailable'
  | 'write_failed'

export type SkillInstallResult =
  | { ok: true; replaced: boolean; skill: InstalledSkillView }
  | {
      code: SkillInstallErrorCode
      conflict?: SkillConflict
      message: string
      ok: false
    }

interface PreparedInstallSource {
  package: PreparedSkillPackage
  sourcePath: string | null
  sourceRef: string | null
  sourceType: AgentSkillSourceType
  sourceUrl: string | null
}

export function toInstalledSkillView(row: AgentSkill): InstalledSkillView {
  return {
    contentHash: row.contentHash,
    createdAt: dateToIso(row.createdAt),
    description: row.description,
    fileCount: row.fileCount,
    name: row.name,
    slug: row.slug,
    sourcePath: row.sourcePath,
    sourceRef: row.sourceRef,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    totalBytes: row.totalBytes,
    updatedAt: dateToIso(row.updatedAt),
  }
}

export async function installSkillForUser(input: {
  agentId: string
  replace?: boolean
  source: SkillInstallSource
  userId: string
}): Promise<SkillInstallResult> {
  const agentRow = await readAgentForUser({
    agentId: input.agentId,
    userId: input.userId,
  })
  if (!agentRow) {
    return {
      code: 'agent_not_found',
      message: 'Agent not found.',
      ok: false,
    }
  }

  const prepared = await prepareInstallSource(input.source)
  if (!prepared.ok) {
    return prepared.error
  }

  const existing = await readSkillByNormalizedName({
    agentId: input.agentId,
    nameNormalized: prepared.value.package.nameNormalized,
  })
  if (existing && input.replace !== true) {
    return {
      code: 'name_conflict',
      conflict: {
        existing: toConflictSkill(existing),
        incoming: {
          description: prepared.value.package.description,
          name: prepared.value.package.name,
        },
      },
      message: `Skill "${prepared.value.package.name}" is already installed.`,
      ok: false,
    }
  }

  const slug =
    existing?.slug ??
    (await allocateSlug({
      agentId: input.agentId,
      contentHash: prepared.value.package.contentHash,
      name: prepared.value.package.name,
    }))

  let sandbox: Sandbox
  try {
    const result = await ensureSkillSandbox(input.agentId)
    sandbox = result.sandbox
  } catch (error) {
    return {
      code: 'sandbox_unavailable',
      message: errorMessage(error, 'Skill Sandbox is unavailable.'),
      ok: false,
    }
  }

  try {
    await installSkillPackageInSandbox({
      package: prepared.value.package,
      replacing: Boolean(existing),
      sandbox,
      slug,
    })
  } catch (error) {
    return {
      code: 'write_failed',
      message: errorMessage(error, 'Could not write skill files.'),
      ok: false,
    }
  }

  const row = await upsertSkillRow({
    agentId: input.agentId,
    package: prepared.value.package,
    slug,
    sourcePath: prepared.value.sourcePath,
    sourceRef: prepared.value.sourceRef,
    sourceType: prepared.value.sourceType,
    sourceUrl: prepared.value.sourceUrl,
  })
  await revalidateSkillSurfaces(input.agentId, input.userId)

  return {
    ok: true,
    replaced: Boolean(existing),
    skill: toInstalledSkillView(row),
  }
}

export async function uninstallSkillForUser(input: {
  agentId: string
  slug: string
  userId: string
}): Promise<{ message: string; ok: false } | { ok: true }> {
  const agentRow = await readAgentForUser({
    agentId: input.agentId,
    userId: input.userId,
  })
  if (!agentRow) {
    return { message: 'Agent not found.', ok: false }
  }

  const row = await readSkillBySlug({
    agentId: input.agentId,
    slug: input.slug,
  })
  if (!row) {
    return { message: 'Skill not found.', ok: false }
  }

  try {
    const sandbox = await getSkillSandbox(input.agentId)
    await removeSkillPackageDir(sandbox, row.slug)
  } catch (error) {
    return {
      message: errorMessage(error, 'Could not remove skill files.'),
      ok: false,
    }
  }

  await db
    .delete(agentSkills)
    .where(
      and(
        eq(agentSkills.agentId, input.agentId),
        eq(agentSkills.slug, row.slug)
      )
    )
  await revalidateSkillSurfaces(input.agentId, input.userId)
  return { ok: true }
}

async function installSkillPackageInSandbox(input: {
  package: PreparedSkillPackage
  replacing: boolean
  sandbox: Sandbox
  slug: string
}): Promise<void> {
  if (!input.replacing) {
    await writeSkillPackageToSandbox({
      package: input.package,
      sandbox: input.sandbox,
      slug: input.slug,
    })
    return
  }

  const tempSlug = tempSkillSlug(input.slug)
  const backupSlug = backupSkillSlug(input.slug)
  let swapped = false
  try {
    await removeSkillPackageDir(input.sandbox, tempSlug)
    await removeSkillPackageDir(input.sandbox, backupSlug)
    await writeSkillPackageToSandbox({
      package: input.package,
      sandbox: input.sandbox,
      slug: tempSlug,
    })
    await swapSkillPackageDir({
      backupSlug,
      sandbox: input.sandbox,
      slug: input.slug,
      tempSlug,
    })
    swapped = true
  } catch (error) {
    await removeSkillPackageDir(input.sandbox, tempSlug).catch(() => undefined)
    if (!swapped) {
      await restoreSkillPackageBackup({
        backupSlug,
        sandbox: input.sandbox,
        slug: input.slug,
      }).catch(() => undefined)
    }
    throw error
  } finally {
    if (swapped) {
      await removeSkillPackageDir(input.sandbox, backupSlug).catch(
        () => undefined
      )
    }
  }
}

async function prepareInstallSource(
  source: SkillInstallSource
): Promise<
  | { ok: true; value: PreparedInstallSource }
  | { error: SkillInstallResult; ok: false }
> {
  try {
    if (source.type === 'skill_md') {
      return {
        ok: true,
        value: {
          package: prepareSkillMdUpload({ content: source.content }),
          sourcePath: null,
          sourceRef: null,
          sourceType: source.type,
          sourceUrl: null,
        },
      }
    }
    if (source.type === 'zip') {
      return {
        ok: true,
        value: {
          package: await prepareSkillZipUpload({ content: source.content }),
          sourcePath: null,
          sourceRef: null,
          sourceType: source.type,
          sourceUrl: null,
        },
      }
    }

    if (source.type === 'skills_sh') {
      const imported = await importSkillsShSkill(source.id)
      return {
        ok: true,
        value: {
          package: imported.package,
          sourcePath: imported.detail.id,
          sourceRef: imported.detail.hash,
          sourceType: source.type,
          sourceUrl: `https://skills.sh/${imported.detail.id}`,
        },
      }
    }

    const imported = await importGitHubSkill(source.url)
    return {
      ok: true,
      value: {
        package: imported.package,
        sourcePath: imported.source.path,
        sourceRef: imported.source.ref,
        sourceType: source.type,
        sourceUrl: imported.source.originalUrl,
      },
    }
  } catch (error) {
    return {
      error: {
        code: installErrorCodeForSource(source.type),
        message: errorMessage(error, 'Invalid skill package.'),
        ok: false,
      },
      ok: false,
    }
  }
}

function installErrorCodeForSource(
  sourceType: SkillInstallSource['type']
): SkillInstallErrorCode {
  if (sourceType === 'github') {
    return 'github_fetch_failed'
  }
  if (sourceType === 'skills_sh') {
    return 'catalog_fetch_failed'
  }
  return 'invalid_package'
}

async function readAgentForUser(input: { agentId: string; userId: string }) {
  const [row] = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, input.agentId), eq(agent.userId, input.userId)))
    .limit(1)
  return row ?? null
}

async function readSkillByNormalizedName(input: {
  agentId: string
  nameNormalized: string
}): Promise<AgentSkill | null> {
  const [row] = await db
    .select()
    .from(agentSkills)
    .where(
      and(
        eq(agentSkills.agentId, input.agentId),
        eq(agentSkills.nameNormalized, input.nameNormalized)
      )
    )
    .limit(1)
  return row ?? null
}

async function readSkillBySlug(input: {
  agentId: string
  slug: string
}): Promise<AgentSkill | null> {
  const [row] = await db
    .select()
    .from(agentSkills)
    .where(
      and(
        eq(agentSkills.agentId, input.agentId),
        eq(agentSkills.slug, input.slug)
      )
    )
    .limit(1)
  return row ?? null
}

async function allocateSlug(input: {
  agentId: string
  contentHash: string
  name: string
}): Promise<string> {
  const rows = await db
    .select({ slug: agentSkills.slug })
    .from(agentSkills)
    .where(eq(agentSkills.agentId, input.agentId))
  return uniqueSkillSlug({
    baseSlug: slugFromSkillName(input.name),
    contentHash: input.contentHash,
    usedSlugs: new Set(rows.map((row) => row.slug)),
  })
}

async function upsertSkillRow(input: {
  agentId: string
  package: PreparedSkillPackage
  slug: string
  sourcePath: string | null
  sourceRef: string | null
  sourceType: AgentSkillSourceType
  sourceUrl: string | null
}): Promise<AgentSkill> {
  const now = new Date()
  const [row] = await db
    .insert(agentSkills)
    .values({
      agentId: input.agentId,
      slug: input.slug,
      name: input.package.name,
      nameNormalized: input.package.nameNormalized,
      description: input.package.description,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl,
      sourceRef: input.sourceRef,
      sourcePath: input.sourcePath,
      contentHash: input.package.contentHash,
      fileCount: input.package.fileCount,
      totalBytes: input.package.totalBytes,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [agentSkills.agentId, agentSkills.slug],
      set: {
        name: input.package.name,
        nameNormalized: input.package.nameNormalized,
        description: input.package.description,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        sourceRef: input.sourceRef,
        sourcePath: input.sourcePath,
        contentHash: input.package.contentHash,
        fileCount: input.package.fileCount,
        totalBytes: input.package.totalBytes,
        updatedAt: now,
      },
    })
    .returning()

  if (!row) {
    throw new Error('Failed to persist skill metadata.')
  }
  return row
}

async function writeSkillPackageToSandbox(input: {
  package: PreparedSkillPackage
  sandbox: Sandbox
  slug: string
}): Promise<void> {
  if (!input.package.files.some((file) => file.path === SKILL_MD_PATH)) {
    throw new Error('Prepared package is missing SKILL.md.')
  }

  const packageDir = skillPackageDir(input.slug)
  await runSandboxCommand({
    args: ['-p', packageDir],
    cmd: 'mkdir',
    errorPrefix: `Could not create skill directory ${packageDir}`,
    sandbox: input.sandbox,
  })

  await writePackageFiles({
    files: input.package.files,
    packageDir,
    sandbox: input.sandbox,
  })
  await chmodExecutableFiles({
    files: input.package.files.filter((file) => file.path !== SKILL_MD_PATH),
    packageDir,
    sandbox: input.sandbox,
  })
}

async function writePackageFiles(input: {
  files: SkillPackageFile[]
  packageDir: string
  sandbox: Sandbox
}): Promise<void> {
  if (input.files.length === 0) {
    return
  }

  const dirs = new Set(
    input.files
      .map((file) =>
        pathDirname(skillPackageFilePath(input.packageDir, file.path))
      )
      .filter((dir) => dir !== input.packageDir)
  )
  for (const dir of dirs) {
    await runSandboxCommand({
      args: ['-p', dir],
      cmd: 'mkdir',
      errorPrefix: `Could not create skill directory ${dir}`,
      sandbox: input.sandbox,
    })
  }

  await input.sandbox.writeFiles(
    input.files.map((file) => ({
      content: file.content,
      path: skillPackageFilePath(input.packageDir, file.path),
    }))
  )
}

async function chmodExecutableFiles(input: {
  files: SkillPackageFile[]
  packageDir: string
  sandbox: Sandbox
}): Promise<void> {
  const executablePaths = input.files
    .filter((file) => file.executable)
    .map((file) => skillPackageFilePath(input.packageDir, file.path))
  if (executablePaths.length === 0) {
    return
  }
  await runSandboxCommand({
    args: ['+x', '--', ...executablePaths],
    cmd: 'chmod',
    errorPrefix: 'Could not mark skill scripts as executable',
    sandbox: input.sandbox,
  })
}

async function removeSkillPackageDir(
  sandbox: Sandbox,
  slug: string
): Promise<void> {
  await runSandboxCommand({
    args: ['-rf', '--', skillPackageDir(slug)],
    cmd: 'rm',
    errorPrefix: `Could not remove skill package ${slug}`,
    sandbox,
  })
}

async function swapSkillPackageDir(input: {
  backupSlug: string
  sandbox: Sandbox
  slug: string
  tempSlug: string
}): Promise<void> {
  const targetDir = skillPackageDir(input.slug)
  const tempDir = skillPackageDir(input.tempSlug)
  const backupDir = skillPackageDir(input.backupSlug)
  await runSandboxCommand({
    args: ['--', targetDir, backupDir],
    cmd: 'mv',
    errorPrefix: `Could not back up skill package ${input.slug}`,
    sandbox: input.sandbox,
  })
  await runSandboxCommand({
    args: ['--', tempDir, targetDir],
    cmd: 'mv',
    errorPrefix: `Could not activate skill package ${input.slug}`,
    sandbox: input.sandbox,
  })
}

async function restoreSkillPackageBackup(input: {
  backupSlug: string
  sandbox: Sandbox
  slug: string
}): Promise<void> {
  await runSandboxCommand({
    args: [
      '--',
      skillPackageDir(input.backupSlug),
      skillPackageDir(input.slug),
    ],
    cmd: 'mv',
    errorPrefix: `Could not restore skill package ${input.slug}`,
    sandbox: input.sandbox,
  })
}

async function runSandboxCommand(input: {
  args: string[]
  cmd: string
  errorPrefix: string
  sandbox: Sandbox
}): Promise<void> {
  const result = await input.sandbox.runCommand({
    args: input.args,
    cmd: input.cmd,
  })
  if (result.exitCode !== 0) {
    const stderr = await result.stderr()
    throw new Error(stderr.trim() || input.errorPrefix)
  }
}

function skillPackageDir(slug: string): string {
  return `${SKILL_PACKAGES_DIR}/${slug}`
}

function skillPackageFilePath(packageDir: string, path: string): string {
  return `${packageDir}/${path}`
}

function tempSkillSlug(slug: string): string {
  return `.${slug}.tmp`
}

function backupSkillSlug(slug: string): string {
  return `.${slug}.backup`
}

function pathDirname(path: string): string {
  return path.slice(0, path.lastIndexOf('/')) || '/'
}

function toConflictSkill(
  row: AgentSkill
): Pick<InstalledSkillView, 'description' | 'name' | 'slug'> {
  return {
    description: row.description,
    name: row.name,
    slug: row.slug,
  }
}

async function revalidateSkillSurfaces(
  agentId: string,
  userId: string
): Promise<void> {
  try {
    await sendAppRevalidation({
      paths: [`/agents/${agentId}/skills`],
      tags: [
        [agentSkillsTag(agentId), 'max'],
        [agentTag(agentId), 'max'],
        [userAgentsTag(userId), 'max'],
      ],
    })
  } catch (error) {
    console.error('[agent-skills] app revalidation failed', error)
  }
}

function dateToIso(value: Date): string {
  return value.toISOString()
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
