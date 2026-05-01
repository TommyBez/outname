import { Sandbox } from '@vercel/sandbox'
import { eq } from 'drizzle-orm'
import {
  EXEC_SANDBOX_WORKSPACE,
  SANDBOX_CONFIGS,
  type SandboxRole,
} from '@/lib/agent-sandbox-registry'
import type { CreateOptions } from '@/lib/agent-sandbox-types'
import { db } from '@/lib/db'
import { agent } from '@/lib/db/schema'

// Role <-> DB column mapping

/**
 * Stable suffix added to the sandbox name. Sandbox names are scoped per
 * Vercel project, so the `${agentId}-${role}` shape is collision-free
 * across agents and roles within the same project.
 */
const ROLE_SUFFIX: Record<SandboxRole, string> = {
  system: 'system',
  exec: 'exec',
}

function nameFor(agentId: string, role: SandboxRole): string {
  return `agent-${agentId}-${ROLE_SUFFIX[role]}`
}

async function readSandboxId(
  agentId: string,
  role: SandboxRole
): Promise<string | null> {
  const [row] = await db
    .select({
      systemId: agent.sandboxSystemId,
      execId: agent.sandboxExecId,
    })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  if (!row) {
    return null
  }
  return role === 'system' ? row.systemId : row.execId
}

async function writeSandboxId(
  agentId: string,
  role: SandboxRole,
  sandboxId: string
): Promise<void> {
  await db
    .update(agent)
    .set({
      ...(role === 'system'
        ? { sandboxSystemId: sandboxId }
        : { sandboxExecId: sandboxId }),
      updatedAt: new Date(),
    })
    .where(eq(agent.id, agentId))
}

// Public types

export interface EnsureResult {
  /** True iff this call created a brand-new sandbox (vs. resumed by id). */
  created: boolean
  sandbox: Sandbox
}

// Lifecycle internals

async function ensureRoleSandbox(
  agentId: string,
  role: SandboxRole,
  createOptions: CreateOptions | undefined
): Promise<EnsureResult> {
  // The persistent sandbox SDK addresses sandboxes by `name`, not by an
  // internal id. The columns are named `sandbox_*_id` for parity with
  // `last_session_run_id` etc.; the value stored in them is the
  // sandbox's name (`agent-${agentId}-${role}`). On the very first boot
  // we both compute and persist that name; after that we reuse it
  // verbatim so an out-of-band rename would force a fresh sandbox.
  const persistedName = await readSandboxId(agentId, role)
  const desiredName = nameFor(agentId, role)
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
      ...createOptions,
      name: desiredName,
      persistent: true,
    })
    created = true
    if (persistedName !== desiredName) {
      await writeSandboxId(agentId, role, desiredName)
    }
  }

  return { sandbox, created }
}

// Marker helpers (setup hooks)

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

// Step primitives — workflow-facing (Neon / Sandbox; not inside `"use workflow"` VM)

/**
 * Ensure the agent's **system** sandbox is booted. The system sandbox
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
  const { created } = await ensureRoleSandbox(
    agentId,
    'system',
    SANDBOX_CONFIGS.system.createOptions
  )

  // Lazily import the seed step so this module doesn't pull workflow
  // primitives (used inside seed-agents-md.ts) when loaded outside a
  // workflow.
  const { seedAgentsMd } = await import(
    '@/workflows/agent-session/steps/seed-agents-md'
  )
  await seedAgentsMd({ agentId, created })
}

/**
 * Ensure the agent's **exec** sandbox is booted and `/workspace`
 * exists. Exec is the sandbox the bash / file-edit tools shell into;
 * its filesystem persists across events via snapshot-on-stop.
 */
export async function startupExecSandbox(input: {
  agentId: string
}): Promise<void> {
  'use step'
  const { agentId } = input
  const { sandbox, created } = await ensureRoleSandbox(
    agentId,
    'exec',
    SANDBOX_CONFIGS.exec.createOptions
  )

  if (created) {
    // Provision the workspace directory once. Subsequent resumes pick
    // it up from the snapshot.
    await sandbox.runCommand({
      cmd: 'sh',
      args: ['-ec', `mkdir -p ${EXEC_SANDBOX_WORKSPACE}`],
    })
  }
}

// Resume handles for tools / end-of-event

/**
 * Resume the agent's system sandbox by name. Throws if startup hasn't
 * run yet (no name persisted). Callers MUST treat this as a Sandbox
 * SDK boundary and run inside a `"use step"` body.
 */
export async function getSystemSandbox(agentId: string): Promise<Sandbox> {
  const name = await readSandboxId(agentId, 'system')
  if (!name) {
    throw new Error(
      `Agent ${agentId} has no system sandbox yet — startupSystemSandbox must run first.`
    )
  }
  return Sandbox.get({ name, resume: true })
}

/**
 * Resume the agent's exec sandbox by name. Same contract as
 * `getSystemSandbox` — startup must have run.
 */
export async function getExecSandbox(agentId: string): Promise<Sandbox> {
  const name = await readSandboxId(agentId, 'exec')
  if (!name) {
    throw new Error(
      `Agent ${agentId} has no exec sandbox yet — startupExecSandbox must run first.`
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

// Reset exec sandbox

/**
 * Throw away the agent's *exec* sandbox and its persisted snapshot,
 * then re-provision a fresh one. Used by the `reset_exec` tool when
 * the model decides its workspace is wedged (broken \`node_modules\`,
 * leftover daemons, half-cloned repos, etc.).
 *
 * The system sandbox is intentionally left alone — memory files
 * survive a reset. After this returns, the next call to
 * `getExecSandbox(agentId)` boots a clean sandbox with an empty
 * `/vercel/sandbox/workspace`.
 */
export async function resetExecSandbox(input: {
  agentId: string
}): Promise<{ destroyed: boolean }> {
  'use step'
  const { agentId } = input
  const previousName = await readSandboxId(agentId, 'exec')

  let destroyed = false
  if (previousName) {
    try {
      const sb = await Sandbox.get({ name: previousName, resume: false })
      await sb.delete()
      destroyed = true
    } catch {
      // Already gone or unreachable. We still proceed — the goal is a
      // clean slate, not a guaranteed prior-state assertion.
    }
  }

  // Re-provision immediately so the next tool call doesn't pay a
  // cold-boot tax in the middle of the agent's reasoning loop. The
  // shared `ensureRoleSandbox` path also persists the (unchanged)
  // sandbox name back, which is a no-op when it already matches.
  const { sandbox } = await ensureRoleSandbox(
    agentId,
    'exec',
    SANDBOX_CONFIGS.exec.createOptions
  )
  await sandbox.runCommand({
    cmd: 'sh',
    args: ['-ec', `mkdir -p ${EXEC_SANDBOX_WORKSPACE}`],
  })

  return { destroyed }
}

// Teardown

/**
 * Permanently delete both of an agent's sandboxes (system + exec) if
 * they exist. Called by `deleteAgentAction` before removing the agent
 * row so we don't leak persistent sandboxes.
 */
export async function destroyAgentSandboxes(agentId: string): Promise<void> {
  const [systemName, execName] = await Promise.all([
    readSandboxId(agentId, 'system'),
    readSandboxId(agentId, 'exec'),
  ])

  await Promise.all(
    [systemName, execName].map(async (name) => {
      if (!name) {
        return
      }
      try {
        const sb = await Sandbox.get({ name, resume: false })
        await sb.delete()
      } catch {
        /* already gone or unreachable */
      }
    })
  )
}
