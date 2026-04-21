import { Sandbox } from "@vercel/sandbox"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { agent } from "@/lib/db/schema"

/**
 * Options passed through to `Sandbox.create` on first boot. `name` and
 * `persistent` are managed by this module — callers should not set them.
 *
 * Defined explicitly (rather than via `Omit<CreateSandboxParams, ...>`) so
 * we don't pick up the snapshot-source variant of the SDK's union type,
 * which is not a shape callers of this helper need.
 */
interface CreateOptions {
  runtime?: string
  timeout?: number
  ports?: number[]
  resources?: { vcpus: number }
  env?: Record<string, string>
  tags?: Record<string, string>
  snapshotExpiration?: number
  onResume?: (sandbox: Sandbox) => Promise<void>
}

interface EnsureOptions {
  agentId: string
  /**
   * Cheap check run on every resume to see if the sandbox already has
   * whatever this agent needs (binaries, caches, installed deps). When it
   * returns false the helper calls `provision`. Safe default: treat as
   * "needs provisioning" by returning false.
   */
  verify?: (sandbox: Sandbox) => Promise<boolean>
  /**
   * Runs once when the sandbox is first created, and again later if
   * `verify` returns false (e.g. binary version bumped, or the sandbox
   * was reset).
   */
  provision?: (sandbox: Sandbox) => Promise<void>
  /**
   * Forwarded to `Sandbox.create` when we boot a new sandbox. Ignored on
   * resume.
   */
  createOptions?: CreateOptions
}

export interface EnsureResult {
  sandbox: Sandbox
  /** Whether `provision` ran for this call. */
  provisioned: boolean
  /** Whether a brand-new sandbox was created (vs. resumed by name). */
  created: boolean
}

/**
 * Obtain a persistent Vercel Sandbox for a given agent.
 *
 * - On first call the helper creates a new persistent sandbox named
 *   `agent-<agentId>`, persists that name on the agent row, and runs
 *   `provision` so callers can install their own tools.
 * - On subsequent calls the sandbox is resumed by name, filesystem intact.
 *   `verify` gets a chance to confirm the state is still usable; if not,
 *   `provision` is re-run.
 *
 * The helper is intentionally agent-kind-agnostic: every gws/gmail-specific
 * concern lives in the agent's own `sandbox/` module, which supplies the
 * right `verify` / `provision` callbacks.
 */
export async function ensureAgentSandbox(
  opts: EnsureOptions,
): Promise<EnsureResult> {
  const [row] = await db
    .select({ sandboxName: agent.sandboxName })
    .from(agent)
    .where(eq(agent.id, opts.agentId))
    .limit(1)
  if (!row) {
    throw new Error(`Agent ${opts.agentId} not found`)
  }

  let sandbox: Sandbox | null = null
  if (row.sandboxName) {
    try {
      sandbox = await Sandbox.get({ name: row.sandboxName, resume: true })
    } catch {
      // Sandbox was deleted or expired externally. Fall through and create
      // a fresh one below, keeping the same name for cache friendliness.
      sandbox = null
    }
  }

  let created = false
  if (!sandbox) {
    const name = row.sandboxName ?? `agent-${opts.agentId}`
    sandbox = await Sandbox.create({
      ...opts.createOptions,
      name,
      persistent: true,
    })
    created = true
    if (row.sandboxName !== name) {
      await db
        .update(agent)
        .set({ sandboxName: name, updatedAt: new Date() })
        .where(eq(agent.id, opts.agentId))
    }
  }

  let provisioned = false
  if (created) {
    // Fresh sandbox -> always provision, no point in calling verify.
    if (opts.provision) {
      await opts.provision(sandbox)
      provisioned = true
    }
  } else if (opts.verify) {
    const ok = await opts.verify(sandbox).catch(() => false)
    if (!ok && opts.provision) {
      await opts.provision(sandbox)
      provisioned = true
    }
  }

  return { sandbox, provisioned, created }
}

/**
 * Graceful handoff: stop the sandbox so Vercel snapshots its filesystem
 * for the next resume. Best-effort — swallows errors because a failed
 * release should never fail an otherwise-successful agent run.
 */
export async function releaseAgentSandbox(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.stop()
  } catch {
    /* ignore */
  }
}

/**
 * Permanently delete the sandbox associated with an agent, if one exists.
 * Callers (e.g. `deleteAgentAction`) invoke this before removing the agent
 * row so we don't leak persistent sandboxes.
 */
export async function destroyAgentSandbox(agentId: string): Promise<void> {
  const [row] = await db
    .select({ sandboxName: agent.sandboxName })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  if (!row?.sandboxName) return

  try {
    const sb = await Sandbox.get({ name: row.sandboxName, resume: false })
    await sb.delete()
  } catch {
    // Already gone or unreachable — nothing to do.
  }
}
