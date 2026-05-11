import { eq } from 'drizzle-orm'
import { resolveConnectionAvailability } from '@/connections/runtime/availability'
import { db } from '@/shared/db'
import type { AgentTool } from '@/shared/db/schema'
import { agentTools } from '@/shared/db/schema'
import type { Reconnect } from '@/tools/catalog/types'
import { resolveToolKindRows } from '@/tools/runtime/tool-kind-plugins'
import { resolveMaintainerRow } from './resolve-tool-plan/maintainer-tools'
import { resolveSubAgentRows } from './resolve-tool-plan/sub-agents'
import type {
  MaintainerRow,
  PlannedSubAgent as PlannedSubAgentType,
  PlannedTool as PlannedToolType,
  ResolveToolPlanResult as ResolveToolPlanResultType,
  SubAgentRow,
} from './resolve-tool-plan/types'

export type {
  PlannedSubAgent,
  PlannedTool,
  ResolveToolPlanResult,
} from './resolve-tool-plan/types'

export async function resolveToolPlan(args: {
  agentId: string
  userId: string
  callStack?: string[]
  depth?: number
}): Promise<ResolveToolPlanResultType> {
  'use step'
  const { agentId, userId } = args
  const callStack = args.callStack ?? []
  const depth = args.depth ?? 0
  const rows = await db
    .select()
    .from(agentTools)
    .where(eq(agentTools.agentId, agentId))

  if (rows.length === 0) {
    return { planned: [], subAgents: [], reconnects: [] }
  }

  const reconnects: Reconnect[] = []
  const planned: PlannedToolType[] = []
  const subAgents: PlannedSubAgentType[] = []
  const { maintainerRows, subAgentRows } = partitionToolRows(rows)

  const maintainerResults = await Promise.all(
    maintainerRows.map((row) => resolveMaintainerRow(row))
  )
  for (const result of maintainerResults) {
    if (result.kind === 'reconnect') {
      reconnects.push(...result.reconnects)
    } else {
      planned.push(result.planned)
    }
  }

  if (subAgentRows.length > 0) {
    const subResult = await resolveSubAgentRows({
      agentId,
      userId,
      callStack,
      depth,
      subAgentRows,
      usedToolIds: new Set(planned.map((plan) => plan.toolId)),
    })
    reconnects.push(...subResult.reconnects)
    subAgents.push(...subResult.subAgents)
  }

  const credentialReconnects = await resolveCredentialReconnects({
    planned,
    userId,
  })
  reconnects.push(...credentialReconnects)

  const reconnectedToolIds = new Set(
    credentialReconnects.map((reconnect) =>
      'toolId' in reconnect ? reconnect.toolId : ''
    )
  )
  const filteredPlanned = planned.filter(
    (plan) => !reconnectedToolIds.has(plan.toolId)
  )

  return { planned: filteredPlanned, subAgents, reconnects }
}

function partitionToolRows(rows: AgentTool[]): {
  maintainerRows: MaintainerRow[]
  subAgentRows: SubAgentRow[]
} {
  const subAgentRows: SubAgentRow[] = []
  const maintainerRows: MaintainerRow[] = []
  for (const row of resolveToolKindRows(rows)) {
    if (row.kind === 'sub_agent') {
      subAgentRows.push(row)
    } else {
      maintainerRows.push(row)
    }
  }
  return { maintainerRows, subAgentRows }
}

async function resolveCredentialReconnects(input: {
  planned: PlannedToolType[]
  userId: string
}): Promise<Reconnect[]> {
  const requirements = input.planned.flatMap(
    (plan) => plan.providerRequirements
  )
  const { reconnects } = await resolveConnectionAvailability({
    userId: input.userId,
    requirements,
  })
  return reconnects
}
