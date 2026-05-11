import {
  getSystemSandbox,
  readMarker,
  SYSTEM_SANDBOX_ROOT,
  writeMarker,
} from '@/agent-runtime/server/agent-sandbox'
import { buildAgentsMdContent } from '@/agents/server/agents-md-template'
import { readLatestPendingFileWrite } from '@/agents/server/pending-writes'

const AGENTS_MD_PATH = `${SYSTEM_SANDBOX_ROOT}/AGENTS.md`
const IDENTITY_MD_PATH = `${SYSTEM_SANDBOX_ROOT}/IDENTITY.md`
const SOUL_MD_PATH = `${SYSTEM_SANDBOX_ROOT}/SOUL.md`
const USER_MD_PATH = `${SYSTEM_SANDBOX_ROOT}/USER.md`
const SEED_MARKER_PATH = `${SYSTEM_SANDBOX_ROOT}/.agents-md-seeded`
// Bump this marker whenever bootstrap seed semantics change and existing
// sandboxes must rewrite their baseline files on the next event.
const SEED_MARKER_VALUE = 'v12'

// Process-local cache: once this process has verified a fresh marker for an
// agent, later events can skip reopening the sandbox just to re-read it.
const verifiedThisProcess = new Set<string>()

// Seed bootstrap files on first boot and re-seed only when the marker changes.
// Once the marker matches, later events leave the agent's own notes alone and
// skip redundant sandbox reads when this process already verified the marker.
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
    // Reuse the on-disk marker when resuming an older snapshot.
    const seeded = await readMarker(sandbox, SEED_MARKER_PATH)
    if (seeded === SEED_MARKER_VALUE) {
      verifiedThisProcess.add(agentId)
      return
    }
  }

  const [agentsMdRow, identityMdRow, soulMdRow, userMdRow] = await Promise.all([
    readLatestPendingFileWrite({ agentId, path: 'AGENTS.md' }),
    readLatestPendingFileWrite({ agentId, path: 'IDENTITY.md' }),
    readLatestPendingFileWrite({ agentId, path: 'SOUL.md' }),
    readLatestPendingFileWrite({ agentId, path: 'USER.md' }),
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
    ...(userMdRow
      ? [
          {
            path: USER_MD_PATH,
            content: Buffer.from(userMdRow.content, 'utf8'),
          },
        ]
      : []),
  ])

  await writeMarker(sandbox, SEED_MARKER_PATH, SEED_MARKER_VALUE)
  verifiedThisProcess.add(agentId)
}
