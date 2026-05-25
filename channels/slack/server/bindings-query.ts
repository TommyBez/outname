import 'server-only'
import { and, eq } from 'drizzle-orm'
import { getChannelInstallationsForUser } from '@/channels/server/installations'
import { db } from '@/shared/db/pool'
import { agentChannelBindings } from '@/shared/db/schema'

export interface SlackBindingView {
  createdAt: string
  externalKey: string
  id: string
  installed: boolean
  kind: 'channel' | 'dm'
  teamId: string
  workspaceName: string | null
}

export interface SlackInstallationView {
  teamId: string
  workspaceName: string | null
}

type SlackInstallationRow = Awaited<
  ReturnType<typeof getChannelInstallationsForUser>
>[number]

export async function listSlackBindingsForAgent(
  agentId: string,
  userId: string
): Promise<{
  bindings: SlackBindingView[]
  installations: SlackInstallationView[]
}> {
  const [installs, rows] = await Promise.all([
    getChannelInstallationsForUser(userId, 'slack'),
    db
      .select()
      .from(agentChannelBindings)
      .where(
        and(
          eq(agentChannelBindings.agentId, agentId),
          eq(agentChannelBindings.channel, 'slack')
        )
      ),
  ])

  const installations = installs.map(toSlackInstallationView)

  const installLookup = new Map(installs.map((row) => [row.externalId, row]))

  const bindings: SlackBindingView[] = rows.map((row) => {
    const install = installLookup.get(row.externalScopeId)
    const meta = (install?.metadata ?? {}) as { teamName?: string }
    return {
      id: row.id,
      teamId: row.externalScopeId,
      externalKey: row.externalKey,
      kind: row.kind,
      workspaceName: meta.teamName ?? null,
      installed: Boolean(install),
      createdAt: row.createdAt.toISOString(),
    }
  })

  return { bindings, installations }
}

export async function listSlackInstallationsForUser(
  userId: string
): Promise<SlackInstallationView[]> {
  const installs = await getChannelInstallationsForUser(userId, 'slack')
  return installs.map(toSlackInstallationView)
}

function toSlackInstallationView(
  row: SlackInstallationRow
): SlackInstallationView {
  const meta = (row.metadata ?? {}) as { teamName?: string }
  return {
    teamId: row.externalId,
    workspaceName: meta.teamName ?? null,
  }
}
