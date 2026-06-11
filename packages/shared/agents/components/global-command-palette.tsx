import { requireSession } from '@outname/auth/server/auth-guard'
import { getCachedAgentsForUser } from '@outname/shared/server/data'
import { CommandPalette } from '@outname/ui/components/layout/command-palette'

/**
 * Server wrapper that feeds the user's agents into the global Cmd+K palette.
 * Mounted once per authenticated layout.
 */
export async function GlobalCommandPalette() {
  const session = await requireSession()
  const agents = await getCachedAgentsForUser(session.user.id)

  return (
    <CommandPalette
      agents={agents.map((agent) => ({
        enabled: agent.enabled,
        id: agent.id,
        name: agent.name,
      }))}
    />
  )
}
