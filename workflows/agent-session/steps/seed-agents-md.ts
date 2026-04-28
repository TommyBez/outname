import {
  getSystemSandbox,
  readMarker,
  writeMarker,
} from "@/lib/agent-sandbox"
import { SYSTEM_SANDBOX_ROOT } from "@/lib/agent-sandbox-registry"
import { AGENTS_MD_TEMPLATE } from "@/lib/agents-md-template"

const AGENTS_MD_PATH = `${SYSTEM_SANDBOX_ROOT}/AGENTS.md`
const SEED_MARKER_PATH = `${SYSTEM_SANDBOX_ROOT}/.agents-md-seeded`
// Bumped to "v4" alongside the architect-driven template rewrite that
// (a) documents the new \`memory_search\` and \`reset_exec\` tools,
// (b) clarifies that AGENTS.md / SOUL.md are user-owned via the UI
// Identity / Instructions tabs (the agent's memory_* tools refuse
// them at the path layer; only the \`drainPendingWrites\` step is
// allowed to mutate them, and it runs after seedAgentsMd so a fresh
// agent with operator-authored content correctly overwrites the
// platform default), and (c) describes the automatic bash audit log
// at \`logs/<UTC date>.md\`. Existing dev agents pick up the new
// template on their next event after deploy.
const SEED_MARKER_VALUE = "v4"

/**
 * Process-local cache of agent ids whose `.agents-md-seeded` marker we
 * have already verified equals the current `SEED_MARKER_VALUE` in this
 * process. Subsequent calls in the same long-lived session can skip
 * the `Sandbox.get` round-trip entirely. Cleared naturally on
 * cold-start / deploy, which is when a `SEED_MARKER_VALUE` bump would
 * trigger a re-seed anyway.
 */
const verifiedThisProcess = new Set<string>()

/**
 * Idempotent step that writes the baseline `AGENTS.md` template into
 * the agent's **system** sandbox on its very first boot — and re-seeds
 * whenever `SEED_MARKER_VALUE` is bumped to roll out a template
 * upgrade.
 *
 * Sentinel-guarded by `.agents-md-seeded`. Once the marker matches the
 * current value, the step never overwrites the agent's evolved notes.
 *
 * `created`-aware fast paths:
 *   - `created === true`  → fresh sandbox; always seed.
 *   - `created === false` and the marker has been verified in this
 *     process → skip the sandbox handle entirely (cheap path for the
 *     long-lived session loop).
 *   - `created === false` and not yet verified → open the sandbox,
 *     read the marker, re-seed if stale, populate the in-process
 *     cache.
 *
 * Called from `startupSystemSandbox` (see `lib/agent-sandbox.ts`).
 */
export async function seedAgentsMd(input: {
  agentId: string
  created?: boolean
}): Promise<void> {
  "use step"
  const { agentId, created = true } = input

  if (!created && verifiedThisProcess.has(agentId)) {
    return
  }

  const sandbox = await getSystemSandbox(agentId)

  if (!created) {
    // We're piggy-backing on an existing snapshot. Honor any marker
    // already on disk from a previous deploy / process.
    const seeded = await readMarker(sandbox, SEED_MARKER_PATH)
    if (seeded === SEED_MARKER_VALUE) {
      verifiedThisProcess.add(agentId)
      return
    }
  }

  await sandbox.writeFiles([
    {
      path: AGENTS_MD_PATH,
      content: Buffer.from(AGENTS_MD_TEMPLATE, "utf8"),
    },
  ])

  await writeMarker(sandbox, SEED_MARKER_PATH, SEED_MARKER_VALUE)
  verifiedThisProcess.add(agentId)
}
