import { eq } from 'drizzle-orm'
import {
  type ProviderRequirement,
  resolveCredentials,
} from '@/connectors/runtime'
import type { RawCredential } from '@/connectors/types'
import { db } from '@/lib/db'
import { agentTools } from '@/lib/db/schema'
import { getMaintainerTool } from '@/tools/registry'
import type { Reconnect } from '@/tools/types'

/**
 * Step boundary that pulls every credential / crypto path OUT of the
 * workflow function bundle.
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
 *   - `planned`     One entry per agent_tools row whose config parsed
 *                   AND whose required credentials are now in `creds`.
 *                   Already filtered for tools that hit reconnects.
 *   - `creds`       provider id -> RawCredential. JSON-safe by design;
 *                   never carries DB rows or encrypted bytes.
 *   - `reconnects`  Same shape `composeSystemPrompt` consumes —
 *                   tool-keyed (`tool_removed`, `config_invalid`) AND
 *                   provider-keyed (`connection_unavailable`).
 */
export interface PlannedTool {
  config: Record<string, unknown>
  requirements: ProviderRequirement[]
  toolId: string
}

export interface ResolveToolPlanResult {
  creds: Record<string, RawCredential>
  planned: PlannedTool[]
  reconnects: Reconnect[]
}

export async function resolveToolPlan(args: {
  agentId: string
  userId: string
}): Promise<ResolveToolPlanResult> {
  'use step'
  const { agentId, userId } = args

  const rows = await db
    .select()
    .from(agentTools)
    .where(eq(agentTools.agentId, agentId))

  if (rows.length === 0) {
    return { planned: [], creds: {}, reconnects: [] }
  }

  const reconnects: Reconnect[] = []
  const planned: PlannedTool[] = []

  // Pass 1: parse rows + validate config. Bad rows go straight to
  // reconnects with no provider id (tool-keyed reconnect reasons).
  for (const row of rows) {
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
    planned.push({
      toolId: row.toolId,
      config: parsedConfig,
      requirements: tool.requirements
        .filter((r) => r.kind === 'connection')
        .map((r) => ({
          provider: r.provider,
          toolId: row.toolId,
        })),
    })
  }

  // Pass 2: resolve credentials. One DB read + decrypt per provider,
  // regardless of how many tools share the connection.
  const requirements = planned.flatMap((p) => p.requirements)
  const { ready, reconnects: credentialReconnects } = await resolveCredentials({
    userId,
    requirements,
  })
  reconnects.push(...credentialReconnects)

  // Drop any tool whose creds didn't fully resolve — the workflow side
  // never calls `tool.build()` with a half-resolved bundle.
  const reconnectedToolIds = new Set(
    credentialReconnects.map((r) => ('toolId' in r ? r.toolId : ''))
  )
  const filteredPlanned = planned.filter(
    (p) => !reconnectedToolIds.has(p.toolId)
  )

  // Materialize the credential map as a plain object so it survives the
  // step boundary (JSON-only) without needing a custom serializer.
  const creds: Record<string, RawCredential> = {}
  for (const [provider, raw] of ready) {
    creds[provider] = raw
  }

  return { planned: filteredPlanned, creds, reconnects }
}
