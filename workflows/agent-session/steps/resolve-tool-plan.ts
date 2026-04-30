import { and, desc, eq, inArray } from 'drizzle-orm'
import {
  type ProviderRequirement,
  resolveCredentials,
} from '@/connectors/runtime'
import type { RawCredential } from '@/connectors/types'
import { db } from '@/lib/db'
import {
  agent,
  agentTools,
  toolSandboxBuilds,
  toolSandboxSnapshots,
} from '@/lib/db/schema'
import { AGENT_TOOL_PREFIX } from '@/tools/agent-tool'
import { getMaintainerTool } from '@/tools/registry'
import { getToolSandboxManifest } from '@/tools/sandboxes'
import type { Reconnect } from '@/tools/types'

/**
 * Step boundary that pulls every credential / crypto path OUT of the
 * workflow function bundle, plus all DB lookups for sub-agents and
 * tool-sandbox readiness.
 *
 * The workflow SDK refuses to bundle `node:crypto` (used by
 * `lib/connection-crypto.ts` for the AES-GCM envelope around stored
 * credentials). By terminating that import graph at this step we keep
 * the workflow runtime's bundle clean: the step runs as a regular
 * Node function, returns a plain JSON-shaped plan, and the workflow
 * just does synchronous `tool.build()` calls on the result.
 *
 * Returns:
 *
 *   - `planned`     One entry per maintainer-tool agent_tools row
 *                   whose config parsed AND whose required
 *                   credentials are now in `creds` AND whose tool
 *                   sandbox snapshot (if any) is ready.
 *   - `subAgents`   Sub-agent rows whose `agent:<childId>` pointer
 *                   resolves to an enabled, owned, non-cyclic, non-
 *                   over-deep child agent. Each has the metadata the
 *                   workflow needs to synthesise an `agent_<id>` tool.
 *   - `creds`       provider id -> RawCredential. JSON-safe by
 *                   design; never carries DB rows or encrypted bytes.
 *   - `reconnects`  Same shape `composeSystemPrompt` consumes —
 *                   tool-keyed and provider-keyed.
 */
export interface PlannedTool {
  config: Record<string, unknown>
  requirements: ProviderRequirement[]
  toolId: string
}

export interface PlannedSubAgent {
  /** Composite tool key the AI SDK will see (e.g. `agent_<childId>`). */
  toolId: string
  childAgentId: string
  childName: string
  childDescription: string | null
  childUserId: string
}

export interface ResolveToolPlanResult {
  creds: Record<string, RawCredential>
  planned: PlannedTool[]
  subAgents: PlannedSubAgent[]
  reconnects: Reconnect[]
}

/**
 * Maximum nesting depth for sub-agent calls. Depth 0 is the top-level
 * agent talking to a user; depth 1 is its first sub-agent; and so on.
 * Three levels is plenty for "delegate this small task" patterns and
 * costs the platform 2^N concurrent sessions worst-case, so we cap.
 */
export const MAX_SUB_AGENT_DEPTH = 3

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
    return { planned: [], subAgents: [], creds: {}, reconnects: [] }
  }

  const reconnects: Reconnect[] = []
  const planned: PlannedTool[] = []
  const subAgents: PlannedSubAgent[] = []

  // Partition rows by tool kind. Maintainer rows are validated
  // synchronously here; sub-agent rows need a DB join we batch below.
  const subAgentRows: { childAgentId: string; toolId: string }[] = []
  for (const row of rows) {
    if (row.toolId.startsWith(AGENT_TOOL_PREFIX)) {
      subAgentRows.push({
        toolId: row.toolId,
        childAgentId: row.toolId.slice(AGENT_TOOL_PREFIX.length),
      })
      continue
    }

    const tool = getMaintainerTool(row.toolId)
    if (!tool) {
      reconnects.push({ toolId: row.toolId, reason: 'tool_removed' })
      continue
    }
    let parsedConfig: Record<string, unknown> = {}
    if (tool.configSchema) {
      const result = tool.configSchema.safeParse(row.config ?? {})
      if (!result.success) {
        reconnects.push({
          toolId: row.toolId,
          reason: 'config_invalid',
          message: result.error.issues
            .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
            .join('; '),
        })
        continue
      }
      parsedConfig = result.data as Record<string, unknown>
    }

    // Validate every `tool_sandbox` requirement against the latest
    // ready snapshot. If the snapshot is missing or the manifest hash
    // has drifted, surface a reconnect so the LLM doesn't see a tool
    // that would crash on first call. A missing manifest in the
    // registry is treated like a removed tool.
    let sandboxBlocked = false
    for (const req of tool.requirements) {
      if (req.kind !== 'tool_sandbox') {
        continue
      }
      const manifest = getToolSandboxManifest(req.manifest)
      if (!manifest) {
        reconnects.push({
          toolId: row.toolId,
          reason: 'tool_sandbox_unavailable',
          manifest: req.manifest,
          message: `Tool sandbox manifest "${req.manifest}" is not registered`,
        })
        sandboxBlocked = true
        break
      }
      const [snap] = await db
        .select()
        .from(toolSandboxSnapshots)
        .where(eq(toolSandboxSnapshots.manifestId, req.manifest))
        .limit(1)

      const desiredHash = manifest.hash
      if (!snap || snap.manifestHash !== desiredHash) {
        // Look for an in-flight build matching the desired hash so the
        // UI can attach to its progress stream rather than starting a
        // duplicate one. We cap at the most recent N to bound cost.
        const [build] = await db
          .select({ id: toolSandboxBuilds.id })
          .from(toolSandboxBuilds)
          .where(
            and(
              eq(toolSandboxBuilds.manifestId, req.manifest),
              eq(toolSandboxBuilds.manifestHash, desiredHash),
              inArray(toolSandboxBuilds.status, ['pending', 'running'])
            )
          )
          .orderBy(desc(toolSandboxBuilds.startedAt))
          .limit(1)

        if (build) {
          reconnects.push({
            toolId: row.toolId,
            reason: 'tool_sandbox_building',
            manifest: req.manifest,
            buildId: build.id,
          })
        } else {
          reconnects.push({
            toolId: row.toolId,
            reason: 'tool_sandbox_unavailable',
            manifest: req.manifest,
            message: `No ready snapshot for "${req.manifest}"`,
          })
        }
        sandboxBlocked = true
        break
      }
    }
    if (sandboxBlocked) {
      continue
    }

    planned.push({
      toolId: row.toolId,
      config: parsedConfig,
      requirements: tool.requirements
        .filter((r): r is { kind: 'connection'; provider: string } => {
          return r.kind === 'connection'
        })
        .map((r) => ({
          provider: r.provider,
          toolId: row.toolId,
        })),
    })
  }

  // Sub-agent validation: owner-only, enabled, cycle, depth.
  if (subAgentRows.length > 0) {
    const childIds = Array.from(
      new Set(subAgentRows.map((s) => s.childAgentId))
    )
    const childRows = await db
      .select({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        userId: agent.userId,
        enabled: agent.enabled,
      })
      .from(agent)
      .where(inArray(agent.id, childIds))

    const byId = new Map(childRows.map((r) => [r.id, r]))

    for (const sub of subAgentRows) {
      const child = byId.get(sub.childAgentId)
      if (!child) {
        reconnects.push({
          toolId: sub.toolId,
          reason: 'sub_agent_unavailable',
          message: 'Sub-agent has been deleted',
        })
        continue
      }
      if (child.userId !== userId) {
        // We never reveal another user's agent — surface as if the
        // sub-agent simply isn't available.
        reconnects.push({
          toolId: sub.toolId,
          reason: 'sub_agent_unavailable',
          message: 'Sub-agent is not owned by the current user',
        })
        continue
      }
      if (!child.enabled) {
        reconnects.push({
          toolId: sub.toolId,
          reason: 'sub_agent_unavailable',
          message: 'Sub-agent is disabled',
        })
        continue
      }
      if (callStack.includes(child.id) || child.id === agentId) {
        reconnects.push({ toolId: sub.toolId, reason: 'sub_agent_cycle' })
        continue
      }
      if (depth + 1 > MAX_SUB_AGENT_DEPTH) {
        reconnects.push({ toolId: sub.toolId, reason: 'sub_agent_depth' })
        continue
      }

      subAgents.push({
        toolId: sub.toolId,
        childAgentId: child.id,
        childName: child.name,
        childDescription: child.description,
        childUserId: child.userId,
      })
    }
  }

  // Pass 2: resolve credentials. One DB read + decrypt per provider,
  // regardless of how many tools share the connection.
  const requirements = planned.flatMap((p) => p.requirements)
  const { ready, reconnects: credentialReconnects } = await resolveCredentials({
    userId,
    requirements,
  })
  reconnects.push(...credentialReconnects)

  // Drop any tool whose creds didn't fully resolve — the workflow
  // side never calls `tool.build()` with a half-resolved bundle.
  const reconnectedToolIds = new Set(
    credentialReconnects.map((r) => ('toolId' in r ? r.toolId : ''))
  )
  const filteredPlanned = planned.filter(
    (p) => !reconnectedToolIds.has(p.toolId)
  )

  // Materialize the credential map as a plain object so it survives
  // the step boundary (JSON-only) without needing a custom serializer.
  const creds: Record<string, RawCredential> = {}
  for (const [provider, raw] of ready) {
    creds[provider] = raw
  }

  return { planned: filteredPlanned, subAgents, creds, reconnects }
}
