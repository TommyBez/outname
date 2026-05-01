import { readLatestPendingFileWrite } from '@/lib/agent-pending-writes'
import { getSystemSandbox, readMarker, writeMarker } from '@/lib/agent-sandbox'
import { SYSTEM_SANDBOX_ROOT } from '@/lib/agent-sandbox-registry'
import { buildAgentsMdContent } from '@/lib/agents-md-template'

const AGENTS_MD_PATH = `${SYSTEM_SANDBOX_ROOT}/AGENTS.md`
const IDENTITY_MD_PATH = `${SYSTEM_SANDBOX_ROOT}/IDENTITY.md`
const SOUL_MD_PATH = `${SYSTEM_SANDBOX_ROOT}/SOUL.md`
const SEED_MARKER_PATH = `${SYSTEM_SANDBOX_ROOT}/.agents-md-seeded`
// Bumped to "v9" to bootstrap `IDENTITY.md` alongside the existing
// AGENTS.md baseline so the first event always has a stable compact
// identity card path available for prompt injection.
//
// Bumped to "v8" when the base template clarified that all memory
// files except AGENTS.md, IDENTITY.md, and SOUL.md are agent-maintained.
//
// Bumped to "v7" when heartbeat behavior moved from the generic
// kickoff prompt into the base AGENTS.md operating contract.
//
// Bumped to "v6" when UI-authored AGENTS.md content changed from
// replacement semantics to "append below the platform base template".
//
// Bumped to "v5" alongside the architect-driven memory-tool rename
// from `memory_*` to `<verb>_memory`. The template body now refers
// to `list_memory`, `read_memory`, `search_memory`, `write_memory`,
// `edit_memory`, and `delete_memory`, so dev agents that already
// have a v4 seed need to re-seed once for the body of AGENTS.md to
// match the actual tool names the model gets handed at construction
// time. The earlier v4 changes (architect rev: documents
// `search_memory` + `reset_exec`, clarifies user ownership of
// AGENTS.md / IDENTITY.md / SOUL.md via the UI tabs,
// documents the automatic bash audit log at `logs/<UTC date>.md`)
// are still in place. Existing dev agents pick up the new template
// on their next event after deploy.
const SEED_MARKER_VALUE = 'v9'

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
  'use step'
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

  const [agentsMdRow, identityMdRow, soulMdRow] = await Promise.all([
    readLatestPendingFileWrite({ agentId, path: 'AGENTS.md' }),
    readLatestPendingFileWrite({ agentId, path: 'IDENTITY.md' }),
    readLatestPendingFileWrite({ agentId, path: 'SOUL.md' }),
  ])

  await sandbox.writeFiles([
    {
      path: AGENTS_MD_PATH,
      content: Buffer.from(
        buildAgentsMdContent({ customInstructions: agentsMdRow?.content }),
        'utf8'
      ),
    },
    {
      path: IDENTITY_MD_PATH,
      content: Buffer.from(identityMdRow?.content ?? '', 'utf8'),
    },
    ...(soulMdRow
      ? [
          {
            path: SOUL_MD_PATH,
            content: Buffer.from(soulMdRow.content, 'utf8'),
          },
        ]
      : []),
  ])

  await writeMarker(sandbox, SEED_MARKER_PATH, SEED_MARKER_VALUE)
  verifiedThisProcess.add(agentId)
}
