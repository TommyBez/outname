import { Sandbox } from "@vercel/sandbox"
import { readAgentSandboxName, readMarker, writeMarker } from "@/lib/agent-sandbox"
import { AGENTS_MD_TEMPLATE } from "@/lib/agents-md-template"

const AGENTS_MD_PATH = "/vercel/sandbox/AGENTS.md"
const SEED_MARKER_PATH = "/vercel/sandbox/.agents-md-seeded"
// Bumped to "v2" alongside the AGENTS.md template rewrite that adds
// the Phase 2 memory-file layout and conventions. Existing dev agents
// pick up the new template on their next event after deploy. Future
// breaking template changes should bump this constant the same way.
const SEED_MARKER_VALUE = "v2"

/**
 * Process-local cache of agent ids whose `.agents-md-seeded` marker we
 * have already verified equals the current `SEED_MARKER_VALUE` in this
 * process. Subsequent calls in the same long-lived session can skip the
 * `Sandbox.get` round-trip entirely. Cleared naturally on cold-start /
 * deploy, which is when a `SEED_MARKER_VALUE` bump would trigger a
 * re-seed anyway.
 */
const verifiedThisProcess = new Set<string>()

/**
 * Idempotent step that writes the baseline `AGENTS.md` template into
 * the agent's sandbox on its very first boot — and re-seeds whenever
 * `SEED_MARKER_VALUE` is bumped to roll out a template upgrade.
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
 *     read the marker, re-seed if stale, populate the in-process cache.
 *
 * Called from `startupAgentSandbox` (see `lib/agent-sandbox.ts`).
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

  const name = await readAgentSandboxName(agentId)
  if (!name) {
    // Sandbox hasn't been created yet — startupAgentSandbox provisions
    // it before we get here, so this should not happen in practice.
    return
  }

  const sandbox = await Sandbox.get({ name, resume: true })

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
