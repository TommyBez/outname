import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agentTools } from '@/lib/db/schema'
import { getMaintainerTool } from './registry'

/**
 * Server-side scope derivation used by the OAuth connect route. NEVER
 * trust client-supplied `?scopes=` — we recompute the union from this
 * agent's `agent_tools` rows + the maintainer registry every time. If
 * an agent has no rows requiring the provider yet, the returned set is
 * empty and the connector decides how to handle that (Google injects
 * `userinfo.email` as a baseline).
 */
export async function unionScopesForAgent(args: {
  agentId: string
  provider: string
}): Promise<string[]> {
  const rows = await db
    .select({ toolId: agentTools.toolId })
    .from(agentTools)
    .where(eq(agentTools.agentId, args.agentId))

  const scopes = new Set<string>()
  for (const row of rows) {
    const tool = getMaintainerTool(row.toolId)
    if (!tool) {
      continue
    }
    for (const req of tool.requirements) {
      if (req.kind !== 'connection' || req.provider !== args.provider) {
        continue
      }
      for (const s of req.scopes ?? []) {
        scopes.add(s)
      }
    }
  }
  return Array.from(scopes)
}

/**
 * Same shape, but for a candidate set of tool ids the user is about to
 * attach (catalog UI uses this to compute "what scopes will I need if I
 * also attach these?" before kicking off OAuth).
 */
export function unionScopesForToolIds(
  provider: string,
  toolIds: string[]
): string[] {
  const scopes = new Set<string>()
  for (const id of toolIds) {
    const tool = getMaintainerTool(id)
    if (!tool) {
      continue
    }
    for (const req of tool.requirements) {
      if (req.kind !== 'connection' || req.provider !== provider) {
        continue
      }
      for (const s of req.scopes ?? []) {
        scopes.add(s)
      }
    }
  }
  return Array.from(scopes)
}
