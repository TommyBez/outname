import { type NetworkPolicy, Sandbox } from '@vercel/sandbox'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { agent } from '@/shared/db/schema'
import { systemSandboxTags } from '@/shared/server/vercel-sandbox-config'

// Keep this surface narrower than the full SDK union so callers only see the
// create-by-runtime options that matter for system sandboxes.
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

// Persistent root for bootstrap files, memory files, logs, and any other
// agent-authored documents.
export const SYSTEM_SANDBOX_ROOT = '/vercel/sandbox'

const SYSTEM_SANDBOX_CREATE_OPTIONS: CreateOptions = {
  runtime: 'node22',
  // File ops are small and bounded.
  timeout: 60_000,
  resources: { vcpus: 1 },
  networkPolicy: 'deny-all',
}

function nameFor(agentId: string): string {
  return `agent-${agentId}-system`
}

function missingSystemSandboxMessage(agentId: string): string {
  return `Agent ${agentId} has no system sandbox yet — startupSystemSandbox must run first.`
}

export function isMissingSystemSandboxError(
  error: unknown,
  agentId: string
): boolean {
  return (
    error instanceof Error &&
    error.message === missingSystemSandboxMessage(agentId)
  )
}

async function readSandboxId(agentId: string): Promise<string | null> {
  const [row] = await db
    .select({
      systemId: agent.sandboxSystemId,
    })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  return row?.systemId ?? null
}

async function writeSandboxId(
  agentId: string,
  sandboxId: string
): Promise<void> {
  await db
    .update(agent)
    .set({
      sandboxSystemId: sandboxId,
      updatedAt: new Date(),
    })
    .where(eq(agent.id, agentId))
}

export interface EnsureResult {
  created: boolean
  sandbox: Sandbox
}

export async function ensureSystemSandbox(
  agentId: string
): Promise<EnsureResult> {
  // The SDK resumes persistent sandboxes by name, so `sandbox_system_id`
  // stores that stable name rather than an opaque SDK id.
  const persistedName = await readSandboxId(agentId)
  const desiredName = nameFor(agentId)
  let sandbox: Sandbox | null = null

  if (persistedName) {
    try {
      sandbox = await Sandbox.get({ name: persistedName })
    } catch {
      sandbox = null
    }
  }

  let created = false
  if (!sandbox) {
    sandbox = await Sandbox.create({
      ...SYSTEM_SANDBOX_CREATE_OPTIONS,
      name: desiredName,
      tags: systemSandboxTags(agentId),
    })
    created = true
    if (persistedName !== desiredName) {
      await writeSandboxId(agentId, desiredName)
    }
  }

  return { sandbox, created }
}

// Returns `null` when the marker file does not exist.
export async function readMarker(
  sandbox: Sandbox,
  path: string
): Promise<string | null> {
  const buf = await sandbox.readFileToBuffer({ path }).catch(() => null)
  return buf ? buf.toString('utf8').trim() : null
}

export async function writeMarker(
  sandbox: Sandbox,
  path: string,
  value: string
): Promise<void> {
  await sandbox.writeFiles([{ path, content: Buffer.from(value, 'utf8') }])
}

// Resume by name. Callers must cross this SDK boundary from inside a `"use
// step"` body.
export async function getSystemSandbox(agentId: string): Promise<Sandbox> {
  const name = await readSandboxId(agentId)
  if (!name) {
    throw new Error(missingSystemSandboxMessage(agentId))
  }
  return Sandbox.get({ name, resume: true })
}

// Best-effort stop so the next operation resumes a fresh SDK session.
export async function releaseSandbox(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.stop()
  } catch {
    /* ignore */
  }
}

// Best-effort delete before removing the agent row so we do not leak a
// persistent sandbox.
export async function destroyAgentSandboxes(agentId: string): Promise<void> {
  const name = await readSandboxId(agentId)
  if (!name) {
    return
  }
  try {
    const sb = await Sandbox.get({ name, resume: false })
    await sb.delete()
  } catch {
    /* already gone or unreachable */
  }
}
