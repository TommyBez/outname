import { Sandbox } from "@vercel/sandbox"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { agent, type AgentKind } from "@/lib/db/schema"

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

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

/**
 * Per-agent-kind sandbox configuration, resolved by `startupAgentSandbox`
 * via the registry. The single `setup` hook owns its own idempotence —
 * typically by checking a version marker on disk before reinstalling
 * anything — and also handles per-run mutation (e.g. rotating
 * credentials). Tools that never touch the sandbox filesystem can omit
 * this entirely; kinds without a registry entry just get a plain empty
 * sandbox.
 */
export interface SandboxSetup {
  /** Forwarded to `Sandbox.create` when booting a new sandbox. */
  createOptions?: CreateOptions
  /**
   * Runs on every `startupAgentSandbox` call, after the sandbox is ready
   * (created or resumed). Receives the fresh `Sandbox` handle and a
   * context object with the owning agent id plus whether the sandbox was
   * just created (`true`) or resumed (`false`).
   */
  setup?: (
    sandbox: Sandbox,
    ctx: { agentId: string; created: boolean },
  ) => Promise<void>
}

interface EnsureOptions {
  agentId: string
  /** Forwarded to `Sandbox.create` when we boot a new sandbox. */
  createOptions?: CreateOptions
}

export interface EnsureResult {
  sandbox: Sandbox
  /** Whether a brand-new sandbox was created (vs. resumed by name). */
  created: boolean
}

/* -------------------------------------------------------------------------- */
/* DB lookup                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Shared read of the persistent sandbox name previously saved on the
 * agent row. Returns `null` before the first successful boot.
 */
export async function readAgentSandboxName(
  agentId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ sandboxName: agent.sandboxName })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  return row?.sandboxName ?? null
}

/* -------------------------------------------------------------------------- */
/* Lifecycle internals                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Obtain a persistent Vercel Sandbox for a given agent.
 *
 * - On first call the helper creates a new persistent sandbox named
 *   `agent-<agentId>` and persists that name on the agent row.
 * - On subsequent calls the sandbox is resumed by name, filesystem
 *   intact.
 *
 * The helper is intentionally agent-kind-agnostic: any tool-specific
 * install/setup work happens in the `SandboxSetup.setup` hook, invoked
 * by `startupAgentSandbox` after this function returns.
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
      // Sandbox was deleted or expired externally. Fall through and
      // create a fresh one below, keeping the same name.
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

  return { sandbox, created }
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
 * Permanently delete the sandbox associated with an agent, if one
 * exists. Callers (e.g. `deleteAgentAction`) invoke this before removing
 * the agent row so we don't leak persistent sandboxes.
 */
export async function destroyAgentSandbox(agentId: string): Promise<void> {
  const name = await readAgentSandboxName(agentId)
  if (!name) return
  try {
    const sb = await Sandbox.get({ name, resume: false })
    await sb.delete()
  } catch {
    // Already gone or unreachable — nothing to do.
  }
}

/* -------------------------------------------------------------------------- */
/* Marker helpers for idempotent setup                                         */
/* -------------------------------------------------------------------------- */

/**
 * Read a small UTF-8 marker file from the sandbox (e.g. a pinned tool
 * version). Returns `null` if the file does not exist.
 */
export async function readMarker(
  sandbox: Sandbox,
  path: string,
): Promise<string | null> {
  const buf = await sandbox.readFileToBuffer({ path }).catch(() => null)
  return buf ? buf.toString("utf8").trim() : null
}

/**
 * Write a small UTF-8 marker file to the sandbox. Use in pair with
 * `readMarker` to make `SandboxSetup.setup` functions idempotent.
 */
export async function writeMarker(
  sandbox: Sandbox,
  path: string,
  value: string,
): Promise<void> {
  await sandbox.writeFiles([
    { path, content: Buffer.from(value, "utf8") },
  ])
}

/* -------------------------------------------------------------------------- */
/* Step primitives — workflow-facing API                                       */
/*                                                                             */
/* These MUST run as steps — they touch fetch-based APIs (Neon HTTP, Vercel    */
/* Sandbox) which are not available inside the `"use workflow"` sandboxed VM. */
/* -------------------------------------------------------------------------- */

/**
 * Ensure the agent's persistent sandbox exists and is ready for the run.
 *
 * Resolves per-kind configuration by reading `agent.kind` and looking it
 * up in `SANDBOX_SETUPS` (see `lib/agent-sandbox-registry.ts`). Agents
 * without a registry entry still get a plain empty sandbox.
 *
 * The registry is imported lazily to avoid a static module cycle
 * (registry → tool module → this file).
 */
export async function startupAgentSandbox(input: {
  agentId: string
}): Promise<void> {
  "use step"
  const { agentId } = input

  const [row] = await db
    .select({ kind: agent.kind })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  if (!row) {
    throw new Error(`Agent ${agentId} not found`)
  }

  const { SANDBOX_SETUPS } = await import("./agent-sandbox-registry")
  // The `kind` column is a plain text with a CHECK constraint — we cast
  // to the union type here rather than throwing on unknown values, so a
  // future kind without a registry entry still boots a plain sandbox.
  const cfg: SandboxSetup =
    SANDBOX_SETUPS[row.kind as AgentKind] ?? {}

  const { sandbox, created } = await ensureAgentSandbox({
    agentId,
    createOptions: cfg.createOptions,
  })

  if (cfg.setup) {
    await cfg.setup(sandbox, { agentId, created })
  }
}

/**
 * Stop the agent's sandbox so Vercel snapshots the filesystem for the
 * next resume. No-op if the agent never booted one. Best-effort — never
 * fails the run.
 */
export async function shutdownAgentSandbox(input: {
  agentId: string
}): Promise<void> {
  "use step"
  const name = await readAgentSandboxName(input.agentId)
  if (!name) return
  try {
    const sandbox = await Sandbox.get({ name, resume: true })
    await releaseAgentSandbox(sandbox)
  } catch {
    /* ignore — nothing to snapshot */
  }
}
