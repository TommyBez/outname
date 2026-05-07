import { Sandbox } from '@vercel/sandbox'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agent } from '@/lib/db/schema'

/**
 * Subset of `Sandbox.create` parameters that we surface here. Defined
 * explicitly (not via `Omit<CreateSandboxParams,...>`) so we don't pick
 * up the snapshot-source variant of the SDK union, which is irrelevant
 * to callers of this helper.
 */
export interface CreateOptions {
  env?: Record<string, string>
  ports?: number[]
  resources?: { vcpus: number }
  runtime?: string
  snapshotExpiration?: number
  tags?: Record<string, string>
  timeout?: number
}

/**
 * Persistent sandbox root inside the agent's system sandbox.
 * `AGENTS.md`, `IDENTITY.md`, `SOUL.md`, `USER.md`, and every memory
 * file the agent writes via the `memory_*` tools live directly under
 * this prefix (e.g. `/vercel/sandbox/journal.md`).
 */
export const SYSTEM_SANDBOX_ROOT = '/vercel/sandbox'

/**
 * Boot parameters for the agent's persistent system sandbox. The
 * sandbox holds the markdown memory volume — `AGENTS.md`,
 * `IDENTITY.md`, `SOUL.md`, and the rest of the memory `*.md` files —
 * read on every event by `composeSystemPrompt` and written by the
 * memory tool's pending-writes queue at end-of-event.
 */
const SYSTEM_SANDBOX_CREATE_OPTIONS: CreateOptions = {
  runtime: 'node22',
  // Memory ops are tiny — read/write a handful of small markdown
  // files. 60s is plenty of headroom for the longest realistic
  // composeSystemPrompt + flush cycle.
  timeout: 60_000,
  resources: { vcpus: 1 },
}

/**
 * Stable name used to address the persistent sandbox. Sandbox names
 * are scoped per Vercel project, so `agent-${agentId}-system` is
 * collision-free across agents within the same project.
 */
function nameFor(agentId: string): string {
  return `agent-${agentId}-system`
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
  /** True iff this call created a brand-new sandbox (vs. resumed by id). */
  created: boolean
  sandbox: Sandbox
}

async function ensureSystemSandbox(agentId: string): Promise<EnsureResult> {
  // The persistent sandbox SDK addresses sandboxes by `name`, not by an
  // internal id. The column is named `sandbox_system_id` for parity
  // with `last_session_run_id` etc.; the value stored in it is the
  // sandbox's name (`agent-${agentId}-system`). On the very first boot
  // we both compute and persist that name; after that we reuse it
  // verbatim so an out-of-band rename would force a fresh sandbox.
  const persistedName = await readSandboxId(agentId)
  const desiredName = nameFor(agentId)
  let sandbox: Sandbox | null = null

  if (persistedName) {
    try {
      sandbox = await Sandbox.get({ name: persistedName, resume: true })
    } catch {
      sandbox = null
    }
  }

  let created = false
  if (!sandbox) {
    sandbox = await Sandbox.create({
      ...SYSTEM_SANDBOX_CREATE_OPTIONS,
      name: desiredName,
      persistent: true,
    })
    created = true
    if (persistedName !== desiredName) {
      await writeSandboxId(agentId, desiredName)
    }
  }

  return { sandbox, created }
}

/**
 * Read a small UTF-8 marker file from a sandbox (e.g. a "/workspace
 * created" sentinel). Returns `null` if the file does not exist.
 */
export async function readMarker(
  sandbox: Sandbox,
  path: string
): Promise<string | null> {
  const buf = await sandbox.readFileToBuffer({ path }).catch(() => null)
  return buf ? buf.toString('utf8').trim() : null
}

/**
 * Write a small UTF-8 marker file to a sandbox. Pair with `readMarker`
 * to make setup hooks idempotent.
 */
export async function writeMarker(
  sandbox: Sandbox,
  path: string,
  value: string
): Promise<void> {
  await sandbox.writeFiles([{ path, content: Buffer.from(value, 'utf8') }])
}

/**
 * Ensure the agent's system sandbox is booted. The system sandbox
 * holds AGENTS.md, IDENTITY.md, SOUL.md, and the agent's memory `*.md`
 * files. After the sandbox is ready we delegate to `seedAgentsMd` to
 * install (or upgrade) the AGENTS.md baseline and bootstrap IDENTITY.md.
 *
 * Idempotent — safe to call from every event handler.
 */
export async function startupSystemSandbox(input: {
  agentId: string
}): Promise<void> {
  'use step'
  const { agentId } = input
  const { created } = await ensureSystemSandbox(agentId)

  // Lazily import the seed step so this module doesn't pull workflow
  // primitives (used inside seed-agents-md.ts) when loaded outside a
  // workflow.
  const { seedAgentsMd } = await import(
    '@/workflows/agent-session/steps/seed-agents-md'
  )
  await seedAgentsMd({ agentId, created })
}

/**
 * Resume the agent's system sandbox by name. Throws if startup hasn't
 * run yet (no name persisted). Callers MUST treat this as a Sandbox
 * SDK boundary and run inside a `"use step"` body.
 */
export async function getSystemSandbox(agentId: string): Promise<Sandbox> {
  const name = await readSandboxId(agentId)
  if (!name) {
    throw new Error(
      `Agent ${agentId} has no system sandbox yet — startupSystemSandbox must run first.`
    )
  }
  return Sandbox.get({ name, resume: true })
}

/**
 * Best-effort soft release: stop the sandbox so Vercel snapshots its
 * filesystem for the next resume. Swallows errors — a failed release
 * never fails an otherwise-successful event.
 */
export async function releaseSandbox(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.stop()
  } catch {
    /* ignore */
  }
}

/**
 * Permanently delete the agent's system sandbox if it exists. Called
 * by `deleteAgentAction` before removing the agent row so we don't
 * leak a persistent sandbox.
 */
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
