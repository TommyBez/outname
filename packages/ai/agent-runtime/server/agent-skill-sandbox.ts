import {
  SKILL_PACKAGES_DIR,
  SKILL_WORKSPACE_DIR,
} from '@outname/ai/agent-runtime/skills/paths'
import { db } from '@outname/db'
import { agent } from '@outname/db/schema'
import {
  skillSandboxTags,
  withVercelSandboxCredentials,
} from '@outname/shared/server/vercel-sandbox-config'
import { type NetworkPolicy, Sandbox } from '@vercel/sandbox'
import { eq } from 'drizzle-orm'

export interface CreateOptions {
  env?: Record<string, string>
  networkPolicy?: NetworkPolicy
  ports?: number[]
  resources?: { vcpus: number }
  runtime?: string
  snapshotExpiration?: number
  tags?: Record<string, string>
  timeout?: number
}

const SKILL_SANDBOX_CREATE_OPTIONS: CreateOptions = {
  runtime: 'node22',
  timeout: 60 * 60 * 1000,
  resources: { vcpus: 1 },
  networkPolicy: 'allow-all',
}

function nameFor(agentId: string): string {
  return `agent-${agentId}-skills`
}

function missingSkillSandboxMessage(agentId: string): string {
  return `Agent ${agentId} has no skill sandbox yet — install an Agent Skill first.`
}

export function isMissingSkillSandboxError(
  error: unknown,
  agentId: string
): boolean {
  return (
    error instanceof Error &&
    error.message === missingSkillSandboxMessage(agentId)
  )
}

async function readSandboxId(agentId: string): Promise<string | null> {
  const [row] = await db
    .select({
      skillsId: agent.sandboxSkillsId,
    })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  return row?.skillsId ?? null
}

async function writeSandboxId(
  agentId: string,
  sandboxId: string
): Promise<void> {
  await db
    .update(agent)
    .set({
      sandboxSkillsId: sandboxId,
      updatedAt: new Date(),
    })
    .where(eq(agent.id, agentId))
}

export interface EnsureSkillSandboxResult {
  created: boolean
  sandbox: Sandbox
}

export async function ensureSkillSandbox(
  agentId: string
): Promise<EnsureSkillSandboxResult> {
  const persistedName = await readSandboxId(agentId)
  const desiredName = nameFor(agentId)
  let sandbox: Sandbox | null = null

  if (persistedName) {
    try {
      sandbox = await Sandbox.get(
        withVercelSandboxCredentials({ name: persistedName, resume: true })
      )
    } catch {
      sandbox = null
    }
  }

  let created = false
  if (!sandbox) {
    sandbox = await Sandbox.create(
      withVercelSandboxCredentials({
        ...SKILL_SANDBOX_CREATE_OPTIONS,
        name: desiredName,
        tags: skillSandboxTags(agentId),
      })
    )
    created = true
    if (persistedName !== desiredName) {
      await writeSandboxId(agentId, desiredName)
    }
  }

  await ensureSkillSandboxDirectories(sandbox)
  return { sandbox, created }
}

export async function getSkillSandbox(agentId: string): Promise<Sandbox> {
  const name = await readSandboxId(agentId)
  if (!name) {
    throw new Error(missingSkillSandboxMessage(agentId))
  }
  return Sandbox.get(withVercelSandboxCredentials({ name, resume: true }))
}

export async function destroySkillSandbox(agentId: string): Promise<void> {
  const name = await readSandboxId(agentId)
  if (!name) {
    return
  }
  try {
    const sandbox = await Sandbox.get(
      withVercelSandboxCredentials({ name, resume: false })
    )
    await sandbox.delete()
  } catch {
    /* already gone or unreachable */
  }
}

async function ensureSkillSandboxDirectories(sandbox: Sandbox): Promise<void> {
  for (const path of [SKILL_PACKAGES_DIR, SKILL_WORKSPACE_DIR]) {
    await ensureDirectory(sandbox, path)
  }
}

async function ensureDirectory(sandbox: Sandbox, path: string): Promise<void> {
  try {
    await sandbox.mkDir(path)
    return
  } catch {
    // Older SDK surfaces and already-existing directories can fall through to
    // mkdir -p, which is idempotent.
  }

  const result = await sandbox.runCommand({
    cmd: 'mkdir',
    args: ['-p', path],
  })
  if (result.exitCode !== 0) {
    const stderr = await result.stderr()
    throw new Error(
      stderr.trim() || `Failed to create skill sandbox directory: ${path}`
    )
  }
}
