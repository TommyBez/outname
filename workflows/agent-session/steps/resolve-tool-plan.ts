import { and, desc, eq, inArray } from 'drizzle-orm'
import {
  type ProviderRequirement,
  resolveConnectionAvailability,
} from '@/connectors/runtime'
import { db } from '@/lib/db'
import {
  agent,
  agentTools,
  toolSandboxBuilds,
  toolSandboxSnapshots,
} from '@/lib/db/schema'
import { getMaintainerTool } from '@/tools/registry'
import { getToolSandboxManifest, manifestHash } from '@/tools/sandboxes'
import { resolveToolKindRows } from '@/tools/tool-kind-plugins'
import type { MaintainerTool, Reconnect } from '@/tools/types'

/**
 * Step boundary that pulls DB lookups for tool planning OUT of the
 * workflow function bundle, plus all sub-agent and tool-sandbox
 * readiness checks.
 *
 * Decrypted credentials are intentionally not part of this plan. The
 * plan only validates that each required connection can decrypt and
 * parse; brokered HTTP still decrypts again at execute time inside a
 * server-only step and injects credentials through Vercel Sandbox
 * network policy.
 *
 * Returns:
 *
 *   - `planned`     One entry per maintainer-tool agent_tools row
 *                   whose config parsed AND whose required connection
 *                   is active AND whose tool sandbox snapshot (if any)
 *                   is ready.
 *   - `subAgents`   Sub-agent rows whose `agent:<childId>` pointer
 *                   resolves to an enabled, owned, non-cyclic, non-
 *                   over-deep child agent. Each has the metadata the
 *                   workflow needs to synthesise an `agent_<id>` tool.
 *   - `reconnects`  Same shape `composeSystemPrompt` consumes —
 *                   tool-keyed and provider-keyed.
 */
export interface PlannedTool {
  config: Record<string, unknown>
  providerRequirements: ProviderRequirement[]
  toolId: string
}

export interface PlannedSubAgent {
  childAgentId: string
  childName: string
  childUserId: string
  /** Composite tool key the AI SDK will see (e.g. `agent_<childId>`). */
  toolId: string
}

export interface ResolveToolPlanResult {
  planned: PlannedTool[]
  reconnects: Reconnect[]
  subAgents: PlannedSubAgent[]
}

/**
 * Maximum nesting depth for sub-agent calls. Depth 0 is the top-level
 * agent talking to a user; depth 1 is its first sub-agent; and so on.
 * Three levels is plenty for "delegate this small task" patterns and
 * costs the platform 2^N concurrent sessions worst-case, so we cap.
 */
export const MAX_SUB_AGENT_DEPTH = 3

interface SubAgentRow {
  childAgentId: string
  toolId: string
}

interface MaintainerRow {
  config: unknown
  toolId: string
}

export async function resolveToolPlan(args: {
  agentId: string
  userId: string
  /**
   * Phase 4: chain of agent ids leading to this one. Empty for a
   * normal user-driven turn; populated when this run was triggered
   * by `dispatchInvocation` from a parent. Used to refuse cycles.
   */
  callStack?: string[]
  /**
   * Phase 4: nesting depth. 0 for normal turns, parentDepth + 1
   * for sub-agent turns. Used to refuse over-deep delegation.
   */
  depth?: number
}): Promise<ResolveToolPlanResult> {
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
  const planned: PlannedTool[] = []
  const subAgents: PlannedSubAgent[] = []

  const subAgentRows: SubAgentRow[] = []
  const maintainerRows: MaintainerRow[] = []
  for (const row of resolveToolKindRows(rows)) {
    if (row.kind === 'sub_agent') {
      subAgentRows.push(row)
    } else {
      maintainerRows.push(row)
    }
  }

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
    })
    reconnects.push(...subResult.reconnects)
    subAgents.push(...subResult.subAgents)
  }

  // Pass 2: resolve connection availability. One DB read per provider,
  // regardless of how many tools share the connection. No secret bytes
  // cross this workflow boundary.
  const requirements = planned.flatMap((p) => p.providerRequirements)
  const { reconnects: credentialReconnects } =
    await resolveConnectionAvailability({
      userId,
      requirements,
    })
  reconnects.push(...credentialReconnects)

  // Drop any tool whose connection didn't fully resolve — the workflow
  // side never calls `tool.build()` with a half-resolved bundle.
  const reconnectedToolIds = new Set(
    credentialReconnects.map((r) => ('toolId' in r ? r.toolId : ''))
  )
  const filteredPlanned = planned.filter(
    (p) => !reconnectedToolIds.has(p.toolId)
  )

  return { planned: filteredPlanned, subAgents, reconnects }
}

type MaintainerOutcome =
  | { kind: 'planned'; planned: PlannedTool }
  | { kind: 'reconnect'; reconnects: Reconnect[] }

async function resolveMaintainerRow(
  row: MaintainerRow
): Promise<MaintainerOutcome> {
  const tool = getMaintainerTool(row.toolId)
  if (!tool) {
    return {
      kind: 'reconnect',
      reconnects: [{ toolId: row.toolId, reason: 'tool_removed' }],
    }
  }

  const parsed = parseMaintainerConfig(tool, row)
  if (parsed.kind === 'reconnect') {
    return parsed
  }

  const sandbox = await checkSandboxRequirements(tool, row.toolId)
  if (sandbox) {
    return { kind: 'reconnect', reconnects: [sandbox] }
  }

  return {
    kind: 'planned',
    planned: {
      toolId: row.toolId,
      config: parsed.config,
      providerRequirements: tool.capabilities
        .filter(
          (r): r is { kind: 'brokered_http'; provider: string } =>
            r.kind === 'brokered_http'
        )
        .map((r) => ({ provider: r.provider, toolId: row.toolId })),
    },
  }
}

type ParsedConfig =
  | { kind: 'parsed'; config: Record<string, unknown> }
  | { kind: 'reconnect'; reconnects: Reconnect[] }

function parseMaintainerConfig(
  tool: MaintainerTool,
  row: MaintainerRow
): ParsedConfig {
  if (!tool.configSchema) {
    return { kind: 'parsed', config: {} }
  }
  const result = tool.configSchema.safeParse(row.config ?? {})
  if (!result.success) {
    return {
      kind: 'reconnect',
      reconnects: [
        {
          toolId: row.toolId,
          reason: 'config_invalid',
          message: result.error.issues
            .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
            .join('; '),
        },
      ],
    }
  }
  return { kind: 'parsed', config: result.data as Record<string, unknown> }
}

/**
 * Returns the first blocking reconnect for this tool's `tool_sandbox`
 * requirements, or `null` if every requirement has a ready snapshot.
 */
async function checkSandboxRequirements(
  tool: MaintainerTool,
  toolId: string
): Promise<Reconnect | null> {
  for (const req of tool.capabilities) {
    if (req.kind !== 'tool_sandbox') {
      continue
    }
    const blocking = await checkSandboxRequirement(req.manifest, toolId)
    if (blocking) {
      return blocking
    }
  }
  return null
}

async function checkSandboxRequirement(
  manifestId: string,
  toolId: string
): Promise<Reconnect | null> {
  try {
    getToolSandboxManifest(manifestId)
  } catch {
    return {
      toolId,
      reason: 'tool_sandbox_unavailable',
      manifest: manifestId,
      message: `Tool sandbox manifest "${manifestId}" is not registered`,
    }
  }

  const [snap] = await db
    .select()
    .from(toolSandboxSnapshots)
    .where(eq(toolSandboxSnapshots.manifestId, manifestId))
    .limit(1)

  const desiredHash = manifestHash(manifestId)
  if (snap && snap.manifestHash === desiredHash) {
    return null
  }

  // Snapshot missing or stale — look for an in-flight build the UI
  // can attach to.
  const [build] = await db
    .select({ id: toolSandboxBuilds.id })
    .from(toolSandboxBuilds)
    .where(
      and(
        eq(toolSandboxBuilds.manifestId, manifestId),
        eq(toolSandboxBuilds.manifestHash, desiredHash),
        inArray(toolSandboxBuilds.status, ['pending', 'running'])
      )
    )
    .orderBy(desc(toolSandboxBuilds.startedAt))
    .limit(1)

  if (build) {
    return {
      toolId,
      reason: 'tool_sandbox_building',
      manifest: manifestId,
      buildId: build.id,
    }
  }
  return {
    toolId,
    reason: 'tool_sandbox_unavailable',
    manifest: manifestId,
    message: `No ready snapshot for "${manifestId}"`,
  }
}

interface SubAgentResolution {
  reconnects: Reconnect[]
  subAgents: PlannedSubAgent[]
}

async function resolveSubAgentRows(input: {
  agentId: string
  userId: string
  callStack: string[]
  depth: number
  subAgentRows: SubAgentRow[]
}): Promise<SubAgentResolution> {
  const { agentId, userId, callStack, depth, subAgentRows } = input
  const reconnects: Reconnect[] = []
  const subAgents: PlannedSubAgent[] = []

  const childIds = Array.from(new Set(subAgentRows.map((s) => s.childAgentId)))
  const childRows = await db
    .select({
      id: agent.id,
      name: agent.name,
      userId: agent.userId,
      enabled: agent.enabled,
    })
    .from(agent)
    .where(inArray(agent.id, childIds))

  const byId = new Map(childRows.map((r) => [r.id, r]))

  for (const sub of subAgentRows) {
    const child = byId.get(sub.childAgentId)
    const validated = validateSubAgentChild({
      sub,
      child,
      userId,
      agentId,
      callStack,
      depth,
    })
    if (validated.kind === 'reconnect') {
      reconnects.push(validated.reconnect)
    } else {
      subAgents.push(validated.planned)
    }
  }

  return { reconnects, subAgents }
}

function validateSubAgentChild(input: {
  sub: SubAgentRow
  child:
    | { id: string; name: string; userId: string; enabled: boolean }
    | undefined
  userId: string
  agentId: string
  callStack: string[]
  depth: number
}):
  | { kind: 'reconnect'; reconnect: Reconnect }
  | { kind: 'planned'; planned: PlannedSubAgent } {
  const { sub, child, userId, agentId, callStack, depth } = input

  if (!child) {
    return {
      kind: 'reconnect',
      reconnect: {
        toolId: sub.toolId,
        reason: 'sub_agent_unavailable',
        message: 'Sub-agent has been deleted',
      },
    }
  }
  if (child.userId !== userId) {
    return {
      kind: 'reconnect',
      reconnect: {
        toolId: sub.toolId,
        reason: 'sub_agent_unavailable',
        message: 'Sub-agent is not owned by the current user',
      },
    }
  }
  if (!child.enabled) {
    return {
      kind: 'reconnect',
      reconnect: {
        toolId: sub.toolId,
        reason: 'sub_agent_unavailable',
        message: 'Sub-agent is disabled',
      },
    }
  }
  if (callStack.includes(child.id) || child.id === agentId) {
    return {
      kind: 'reconnect',
      reconnect: { toolId: sub.toolId, reason: 'sub_agent_cycle' },
    }
  }
  if (depth + 1 > MAX_SUB_AGENT_DEPTH) {
    return {
      kind: 'reconnect',
      reconnect: { toolId: sub.toolId, reason: 'sub_agent_depth' },
    }
  }
  return {
    kind: 'planned',
    planned: {
      toolId: sub.toolId,
      childAgentId: child.id,
      childName: child.name,
      childUserId: child.userId,
    },
  }
}
