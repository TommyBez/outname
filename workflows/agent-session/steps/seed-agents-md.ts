import { Sandbox } from "@vercel/sandbox"
import { readAgentSandboxName, readMarker, writeMarker } from "@/lib/agent-sandbox"
import { AGENTS_MD_TEMPLATE } from "@/lib/agents-md-template"

const AGENTS_MD_PATH = "/vercel/sandbox/AGENTS.md"
const SEED_MARKER_PATH = "/vercel/sandbox/.agents-md-seeded"
const SEED_MARKER_VALUE = "v1"

/**
 * Idempotent step that writes the baseline `AGENTS.md` template into
 * the agent's sandbox exactly once per agent.
 *
 * Sentinel-guarded by `.agents-md-seeded`: subsequent deploys that bump
 * `AGENTS_MD_TEMPLATE` will **not** clobber an agent's evolved notes.
 * The template is a starting point — the agent owns the file from the
 * second boot onward.
 *
 * Called after `cfg.setup` inside `startupAgentSandbox` (see
 * `lib/agent-sandbox.ts`) so it runs on every event in the session
 * loop, but the marker check turns it into a no-op after the first
 * successful seed.
 */
export async function seedAgentsMd(input: { agentId: string }): Promise<void> {
  "use step"

  const name = await readAgentSandboxName(input.agentId)
  if (!name) {
    // Sandbox hasn't been created yet — startupAgentSandbox provisions
    // it before we get here, so this should not happen in practice.
    return
  }

  const sandbox = await Sandbox.get({ name, resume: true })

  const seeded = await readMarker(sandbox, SEED_MARKER_PATH)
  if (seeded === SEED_MARKER_VALUE) return

  await sandbox.writeFiles([
    {
      path: AGENTS_MD_PATH,
      content: Buffer.from(AGENTS_MD_TEMPLATE, "utf8"),
    },
  ])

  await writeMarker(sandbox, SEED_MARKER_PATH, SEED_MARKER_VALUE)
}
