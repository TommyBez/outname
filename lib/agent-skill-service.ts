import 'server-only'
import { createHash } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { buildSkillBundleFromMarkdown } from './agent-skill-parser'
import {
  buildSkillBundleFromGithub,
  buildSkillBundleFromZip,
} from './agent-skill-sources'
import type {
  AgentSkillSourceType,
  ParsedSkillBundle,
  SkillIngestResult,
} from './agent-skill-types'
import { agentSkillsTag, agentTag, agentToolsTag } from './cache-tags'
import { db } from './db'
import {
  type AgentSkill,
  type AgentSkillFile,
  agent,
  agentSkillFiles,
  agentSkills,
} from './db/schema'

interface IngestArgs {
  agentId: string
  userId: string
}

async function assertAgentOwnership(
  agentId: string,
  userId: string
): Promise<void> {
  const [row] = await db
    .select({ userId: agent.userId })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  if (!row) {
    throw new Error('Agent not found.')
  }
  if (row.userId !== userId) {
    throw new Error('Forbidden.')
  }
}

export async function addSkillFromMarkdown(
  args: IngestArgs & { content: string; sourceLabel?: string }
): Promise<SkillIngestResult> {
  try {
    await assertAgentOwnership(args.agentId, args.userId)
    const bundle = buildSkillBundleFromMarkdown(args.content)
    const name = await persistSkill({
      agentId: args.agentId,
      bundle,
      sourceType: 'markdown',
      sourceRef: args.sourceLabel ?? null,
    })
    revalidateSkillSurfaces(args.agentId, args.userId)
    return { ok: true, name }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to add skill.',
    }
  }
}

export async function addSkillFromZip(
  args: IngestArgs & { bytes: Uint8Array; sourceLabel?: string }
): Promise<SkillIngestResult> {
  try {
    await assertAgentOwnership(args.agentId, args.userId)
    const bundle = buildSkillBundleFromZip({ bytes: args.bytes })
    const name = await persistSkill({
      agentId: args.agentId,
      bundle,
      sourceType: 'zip',
      sourceRef: args.sourceLabel ?? null,
    })
    revalidateSkillSurfaces(args.agentId, args.userId)
    return { ok: true, name }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to add skill.',
    }
  }
}

export async function addSkillFromGithub(
  args: IngestArgs & { source: string }
): Promise<SkillIngestResult> {
  try {
    await assertAgentOwnership(args.agentId, args.userId)
    const { bundle, resolvedRef } = await buildSkillBundleFromGithub({
      source: args.source,
    })
    const name = await persistSkill({
      agentId: args.agentId,
      bundle,
      sourceType: 'github',
      sourceRef: `${args.source.trim()}@${resolvedRef}`,
    })
    revalidateSkillSurfaces(args.agentId, args.userId)
    return { ok: true, name }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to add skill.',
    }
  }
}

export async function removeSkill(args: {
  agentId: string
  name: string
  userId: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertAgentOwnership(args.agentId, args.userId)
    await db
      .delete(agentSkillFiles)
      .where(
        and(
          eq(agentSkillFiles.agentId, args.agentId),
          eq(agentSkillFiles.skillName, args.name)
        )
      )
    await db
      .delete(agentSkills)
      .where(
        and(
          eq(agentSkills.agentId, args.agentId),
          eq(agentSkills.name, args.name)
        )
      )
    revalidateSkillSurfaces(args.agentId, args.userId)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to remove skill.',
    }
  }
}

interface PersistArgs {
  agentId: string
  bundle: ParsedSkillBundle
  sourceRef: string | null
  sourceType: AgentSkillSourceType
}

async function persistSkill(args: PersistArgs): Promise<string> {
  const { agentId, bundle, sourceType, sourceRef } = args
  const { metadata, files } = bundle

  await db
    .insert(agentSkills)
    .values({
      agentId,
      name: metadata.name,
      description: metadata.description,
      sourceType,
      sourceRef,
      status: 'ready',
      error: null,
    })
    .onConflictDoUpdate({
      target: [agentSkills.agentId, agentSkills.name],
      set: {
        description: metadata.description,
        sourceType,
        sourceRef,
        status: 'ready',
        error: null,
        updatedAt: new Date(),
      },
    })

  // Replace the file set wholesale — re-ingesting a skill should
  // remove any files that aren't in the new bundle.
  await db
    .delete(agentSkillFiles)
    .where(
      and(
        eq(agentSkillFiles.agentId, agentId),
        eq(agentSkillFiles.skillName, metadata.name)
      )
    )
  if (files.length > 0) {
    await db.insert(agentSkillFiles).values(
      files.map((f) => ({
        agentId,
        skillName: metadata.name,
        path: f.path,
        content: f.content,
        sha256: createHash('sha256').update(f.content).digest('hex'),
        executable: f.executable,
      }))
    )
  }
  return metadata.name
}

export async function listAgentSkills(agentId: string): Promise<AgentSkill[]> {
  return await db
    .select()
    .from(agentSkills)
    .where(eq(agentSkills.agentId, agentId))
    .orderBy(asc(agentSkills.name))
}

export interface AgentSkillWithFiles {
  files: AgentSkillFile[]
  skill: AgentSkill
}

export async function loadAgentSkillsWithFiles(
  agentId: string
): Promise<AgentSkillWithFiles[]> {
  const skills = await db
    .select()
    .from(agentSkills)
    .where(
      and(eq(agentSkills.agentId, agentId), eq(agentSkills.status, 'ready'))
    )
    .orderBy(asc(agentSkills.name))
  if (skills.length === 0) {
    return []
  }
  const files = await db
    .select()
    .from(agentSkillFiles)
    .where(eq(agentSkillFiles.agentId, agentId))

  const byName = new Map<string, AgentSkillFile[]>()
  for (const f of files) {
    const list = byName.get(f.skillName) ?? []
    list.push(f)
    byName.set(f.skillName, list)
  }
  return skills.map((skill) => ({
    skill,
    files: byName.get(skill.name) ?? [],
  }))
}

function revalidateSkillSurfaces(agentId: string, _userId: string): void {
  revalidateTag(agentSkillsTag(agentId), 'max')
  // Skills feed into the system prompt + tool dict; bust the same tags
  // we use for tool changes so the catalog UI refreshes.
  revalidateTag(agentToolsTag(agentId), 'max')
  revalidateTag(agentTag(agentId), 'max')
}
