import {
  createAgentUIStreamResponse,
  stepCountIs,
  ToolLoopAgent,
  tool,
  type UIMessage,
} from 'ai'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getConnector } from '@/connectors/registry'
import {
  attachMaintainerToolForUser,
  attachSubAgentForUser,
  detachToolForUser,
} from '@/lib/agent-tool-attachment-service'
import { updateAgentForUser } from '@/lib/agent-update-service'
import { auth } from '@/lib/auth'
import {
  type BudgetPeriod,
  deleteBudgetRuleForScope,
  listAgentBudgetRules,
  upsertBudgetRule,
} from '@/lib/budget'
import { agentTag, userAgentsTag, userBudgetTag } from '@/lib/cache-tags'
import {
  getAgentByIdForUser,
  getAgentMemoryFile,
  getAgentsForUser,
  getAgentTools,
  getUserConnections,
} from '@/lib/data'
import { db } from '@/lib/db'
import { pendingFileWrites } from '@/lib/db/schema'
import { describeConfigSchema } from '@/lib/zod-config-fields'
import { listMaintainerTools } from '@/tools/registry'
import { childAgentIdFromSubAgentRow } from '@/tools/sub-agent-tool-name'

const EDIT_MODEL = 'deepseek/deepseek-v4-flash'

const updateSchema = z.object({
  name: z.string().min(1),
  model: z.string().min(1),
  heartbeatEnabled: z.boolean(),
  heartbeatIntervalMinutes: z.number().int().min(5).max(1440),
  reflectionEnabled: z.boolean(),
  reflectionIntervalMinutes: z.number().int().min(5).max(1440),
  stepLimitMode: z.enum(['custom', 'grind', 'high', 'low', 'medium']),
  stepLimitCustom: z.number().int().min(1).nullable(),
  identityCard: z.string(),
  soul: z.string(),
  instructions: z.string(),
  userProfile: z.string(),
})

const attachMaintainerToolSchema = z.object({
  toolId: z.string().min(1),
  config: z.record(z.unknown()).default({}),
})

const attachSubAgentToolSchema = z.object({
  childAgentId: z.string().min(1),
})

const detachToolSchema = z.object({
  toolId: z.string().min(1),
  kind: z.enum(['maintainer', 'sub_agent']).default('maintainer'),
})

const budgetLimitSchema = z
  .number()
  .positive()
  .max(100_000)
  .nullable()
  .describe('USD cap for this period, or null to clear it.')

const proposeBudgetInputSchema = z.object({
  daily: budgetLimitSchema.default(null),
  weekly: budgetLimitSchema.default(null),
  monthly: budgetLimitSchema.default(null),
  rationale: z
    .string()
    .default('')
    .describe('Short explanation of the suggested budget.'),
})

const setBudgetSchema = z.object({
  daily: budgetLimitSchema.default(null),
  weekly: budgetLimitSchema.default(null),
  monthly: budgetLimitSchema.default(null),
})

export async function POST(
  req: Request,
  ctx: { params: Promise<{ agentId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { agentId } = await ctx.params
  const existing = await getAgentByIdForUser(agentId, session.user.id)
  if (!existing) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  let body: { messages?: UIMessage[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }

  const toolVisibility = await getAvailableAgentTools(agentId, session.user.id)
  const agent = new ToolLoopAgent({
    model: EDIT_MODEL,
    stopWhen: stepCountIs(8),
    instructions: buildEditInstructions(toolVisibility),
    tools: {
      get_current_agent_config: tool({
        description:
          'Get current editable agent configuration, including attached and available tools.',
        inputSchema: z.object({}),
        execute: async () => {
          const [current, tools] = await Promise.all([
            getCurrent(agentId, session.user.id),
            getAvailableAgentTools(agentId, session.user.id),
          ])
          return { ...current, tools }
        },
      }),
      get_available_agent_tools: tool({
        description:
          'List maintainer tools, current tool attachments, provider connection states, and attachable sub-agents.',
        inputSchema: z.object({}),
        execute: async () => getAvailableAgentTools(agentId, session.user.id),
      }),
      apply_agent_edit: tool({
        description: 'Apply the final edit after user approval.',
        inputSchema: updateSchema,
        needsApproval: true,
        execute: async (input) => {
          const current = await getCurrent(agentId, session.user.id)
          await updateAgentForUser({
            id: agentId,
            ...input,
            identityCardOriginal: current.identityCard,
            soulOriginal: current.soul,
            instructionsOriginal: current.instructions,
            userProfileOriginal: current.userProfile,
            userId: session.user.id,
          })
          revalidateAgentEditSurfaces(agentId, session.user.id)
          return { ok: true, agentId }
        },
      }),
      attach_maintainer_tool: tool({
        description:
          'Attach or update a maintainer tool on this agent after user approval. Use get_available_agent_tools first so you know the required config fields.',
        inputSchema: attachMaintainerToolSchema,
        needsApproval: true,
        execute: async (input) =>
          attachMaintainerToolForUser({
            agentId,
            toolId: input.toolId,
            rawConfig: input.config ?? {},
            userId: session.user.id,
          }),
      }),
      attach_sub_agent_tool: tool({
        description:
          'Attach one of the user-owned agents as a callable sub-agent tool after user approval.',
        inputSchema: attachSubAgentToolSchema,
        needsApproval: true,
        execute: async (input) =>
          attachSubAgentForUser({
            parentAgentId: agentId,
            childAgentId: input.childAgentId,
            userId: session.user.id,
          }),
      }),
      detach_agent_tool: tool({
        description:
          'Detach a maintainer or sub-agent tool from this agent after user approval. Use the exact attached toolId from get_available_agent_tools.',
        inputSchema: detachToolSchema,
        needsApproval: true,
        execute: async (input) =>
          detachToolForUser({
            agentId,
            toolId: input.toolId,
            kind: input.kind,
            userId: session.user.id,
          }),
      }),
      get_agent_budget: tool({
        description:
          'Read the current per-agent USD spend caps before proposing a change.',
        inputSchema: z.object({}),
        execute: async () => loadAgentBudget(agentId, session.user.id),
      }),
      propose_agent_budget: tool({
        description:
          'Propose USD spend caps for this agent. The UI renders an editable widget with these values; the operator adjusts and submits. Wait for the user follow-up message before calling set_agent_budget.',
        inputSchema: proposeBudgetInputSchema,
        execute: async (input) => ({
          proposed: {
            daily: input.daily,
            weekly: input.weekly,
            monthly: input.monthly,
          },
          rationale: input.rationale,
        }),
      }),
      set_agent_budget: tool({
        description:
          'Persist the per-agent USD spend caps after user approval. Pass `null` for any period to clear that cap. Use the values the user confirmed via propose_agent_budget.',
        inputSchema: setBudgetSchema,
        needsApproval: true,
        execute: async (input) => {
          const result = await applyAgentBudget({
            agentId,
            userId: session.user.id,
            daily: input.daily,
            weekly: input.weekly,
            monthly: input.monthly,
          })
          revalidateAgentEditSurfaces(agentId, session.user.id)
          return result
        },
      }),
    },
  })

  return createAgentUIStreamResponse({ agent, uiMessages: body.messages })
}

function revalidateAgentEditSurfaces(agentId: string, userId: string): void {
  revalidateTag(userAgentsTag(userId), 'max')
  revalidateTag(agentTag(agentId), 'max')
  revalidateTag(userBudgetTag(userId), 'max')
  revalidatePath('/agents')
  revalidatePath(`/agents/${agentId}`)
  revalidatePath(`/agents/${agentId}/edit`)
  revalidatePath('/')
}

const BUDGET_PERIOD_KEYS: Array<{
  key: 'daily' | 'weekly' | 'monthly'
  period: BudgetPeriod
}> = [
  { key: 'daily', period: 'daily' },
  { key: 'weekly', period: 'weekly' },
  { key: 'monthly', period: 'monthly' },
]

async function loadAgentBudget(
  agentId: string,
  userId: string
): Promise<{
  daily: number | null
  weekly: number | null
  monthly: number | null
}> {
  const rules = await listAgentBudgetRules({ userId, agentId })
  const result: {
    daily: number | null
    weekly: number | null
    monthly: number | null
  } = {
    daily: null,
    weekly: null,
    monthly: null,
  }
  for (const rule of rules) {
    if (!rule.enabled) {
      continue
    }
    const limit = Number(rule.limitUsd)
    if (!Number.isFinite(limit) || limit <= 0) {
      continue
    }
    if (rule.period === 'daily') {
      result.daily = limit
    } else if (rule.period === 'weekly') {
      result.weekly = limit
    } else if (rule.period === 'monthly') {
      result.monthly = limit
    }
  }
  return result
}

async function applyAgentBudget(input: {
  agentId: string
  userId: string
  daily: number | null
  weekly: number | null
  monthly: number | null
}): Promise<{
  ok: true
  applied: Array<{ period: BudgetPeriod; limitUsd: number | null }>
}> {
  const applied: Array<{ period: BudgetPeriod; limitUsd: number | null }> = []
  for (const { key, period } of BUDGET_PERIOD_KEYS) {
    const value = input[key]
    if (value === null) {
      const removed = await deleteBudgetRuleForScope({
        userId: input.userId,
        agentId: input.agentId,
        period,
      })
      if (removed) {
        applied.push({ period, limitUsd: null })
      }
      continue
    }
    if (!Number.isFinite(value) || value <= 0) {
      continue
    }
    await upsertBudgetRule({
      userId: input.userId,
      agentId: input.agentId,
      period,
      limitUsd: value,
    })
    applied.push({ period, limitUsd: value })
  }
  return { ok: true, applied }
}

type ToolVisibility = Awaited<ReturnType<typeof getAvailableAgentTools>>

function buildEditInstructions(toolVisibility: ToolVisibility): string {
  return [
    'You are an agent editing assistant.',
    'Ask concise questions when the requested change is ambiguous. When the requested change is clear, summarize the planned edit and call the appropriate approval-gated tool.',
    'For normal configuration, call apply_agent_edit with the complete final config. For maintainer tools, call attach_maintainer_tool. For user-owned agents used as tools, call attach_sub_agent_tool. For removals, call detach_agent_tool.',
    'Before any attach or detach operation, inspect get_available_agent_tools if the current conversation does not already include the exact current tool state. Never invent tool ids, config fields, or sub-agent ids.',
    'Attach and detach operations automatically request user approval. Do not ask the user to type a magic confirmation phrase; explain the operation and let the app approval UI handle approval.',
    'If a required provider connection is missing or invalid, mention that the user may need to connect it in Settings. Attaching is still allowed if the user explicitly wants to pre-wire the tool.',
    'For per-agent budget changes (daily / weekly / monthly USD caps), first call get_agent_budget if you do not already know the current values, then call propose_agent_budget exactly once with sensible suggested defaults. The UI renders an inline editor with those values; the operator adjusts and submits, sending a follow-up message with the chosen values. Use those user-confirmed numbers to call set_agent_budget — pass `null` for any period the user wants cleared.',
    `Current tool snapshot: ${formatToolVisibilitySummary(toolVisibility)}`,
  ].join('\n')
}

function formatToolVisibilitySummary(toolVisibility: ToolVisibility): string {
  const maintainerTools = toolVisibility.maintainerTools
    .map((item) => {
      const status = item.attached
        ? `attached:${item.attached.status}`
        : 'available'
      const providers =
        item.providers.length > 0
          ? item.providers
              .map(
                (provider) =>
                  `${provider.provider}:${provider.status ?? 'missing'}`
              )
              .join(',')
          : 'no-provider'
      return `${item.toolId}(${status};${providers})`
    })
    .join('; ')
  const removedTools = toolVisibility.removedMaintainerTools
    .map((item) => `${item.toolId}(attached:removed-from-catalog)`)
    .join('; ')
  const subAgents = toolVisibility.subAgents
    .map(
      (item) =>
        `${item.name}[${item.childAgentId}](${item.attached ? `attached:${item.toolId}` : 'available'})`
    )
    .join('; ')

  return [
    `maintainer tools: ${maintainerTools || 'none'}`,
    `removed attached tools: ${removedTools || 'none'}`,
    `sub-agent candidates: ${subAgents || 'none'}`,
  ].join(' | ')
}

async function getCurrent(agentId: string, userId: string) {
  const agentRow = await getAgentByIdForUser(agentId, userId)
  if (!agentRow) {
    throw new Error('Not found')
  }
  const [identityCard, soul, instructions, userProfile] = await Promise.all([
    resolveBootstrap(agentId, 'IDENTITY.md'),
    resolveBootstrap(agentId, 'SOUL.md'),
    resolveBootstrap(agentId, 'AGENTS.md'),
    resolveBootstrap(agentId, 'USER.md'),
  ])
  return {
    name: agentRow.name,
    model: agentRow.model,
    heartbeatEnabled: agentRow.heartbeatEnabled,
    heartbeatIntervalMinutes: agentRow.heartbeatIntervalMinutes,
    reflectionEnabled: agentRow.reflectionEnabled,
    reflectionIntervalMinutes: agentRow.reflectionIntervalMinutes,
    stepLimitMode: (agentRow.stepLimitMode ?? 'medium') as
      | 'custom'
      | 'grind'
      | 'high'
      | 'low'
      | 'medium',
    stepLimitCustom: agentRow.stepLimitCustom,
    identityCard,
    soul,
    instructions,
    userProfile,
  }
}

async function getAvailableAgentTools(agentId: string, userId: string) {
  const [attachedRows, connectionRows, userAgents] = await Promise.all([
    getAgentTools(agentId),
    getUserConnections(userId),
    getAgentsForUser(userId),
  ])

  const maintainerAttachedRows = attachedRows.filter(
    (row) => row.kind === 'maintainer'
  )
  const subAgentAttachedRows = attachedRows.filter(
    (row) => row.kind === 'sub_agent'
  )
  const attachedByMaintainerToolId = new Map(
    maintainerAttachedRows.map((row) => [row.toolId, row])
  )
  const connectionByProvider = new Map(
    connectionRows.map((row) => [row.provider, row])
  )
  const catalogToolIds = new Set(listMaintainerTools().map((item) => item.id))

  const maintainerTools = listMaintainerTools().map((item) => {
    const attached = attachedByMaintainerToolId.get(item.id)
    const providerIds = item.capabilities
      .filter((capability) => capability.kind === 'brokered_http')
      .map((capability) => capability.provider)
    const toolSandboxManifest =
      item.capabilities.find((capability) => capability.kind === 'tool_sandbox')
        ?.manifest ?? null

    return {
      kind: 'maintainer' as const,
      toolId: item.id,
      displayName: item.displayName,
      category: item.category,
      description: item.description,
      configFields: describeConfigSchema(item.configSchema),
      toolSandboxManifest,
      providers: providerIds.map((provider) => {
        const connection = connectionByProvider.get(provider)
        const connector = getConnector(provider)
        return {
          provider,
          displayName: connector?.displayName ?? provider,
          status: connection?.status ?? null,
        }
      }),
      attached: attached
        ? {
            toolId: attached.toolId,
            config: (attached.config ?? {}) as Record<string, unknown>,
            status: attached.status,
            toolSandboxError: attached.toolSandboxError,
          }
        : null,
    }
  })

  const removedMaintainerTools = maintainerAttachedRows
    .filter((row) => !catalogToolIds.has(row.toolId))
    .map((row) => ({
      kind: 'maintainer' as const,
      toolId: row.toolId,
      attached: {
        toolId: row.toolId,
        config: (row.config ?? {}) as Record<string, unknown>,
        status: row.status,
        toolSandboxError: row.toolSandboxError,
      },
    }))

  const attachedSubAgentByChildId = new Map(
    subAgentAttachedRows.map((row) => [
      childAgentIdFromSubAgentRow({
        config: row.config,
        toolId: row.toolId,
      }),
      row,
    ])
  )
  const subAgents = userAgents
    .filter((item) => item.id !== agentId)
    .map((item) => {
      const attached = attachedSubAgentByChildId.get(item.id)
      return {
        kind: 'sub_agent' as const,
        childAgentId: item.id,
        name: item.name,
        enabled: item.enabled,
        attached: attached !== undefined,
        toolId: attached?.toolId ?? null,
      }
    })

  return {
    maintainerTools,
    removedMaintainerTools,
    subAgents,
  }
}

async function resolveBootstrap(agentId: string, path: string) {
  const [latest] = await db
    .select()
    .from(pendingFileWrites)
    .where(
      and(
        eq(pendingFileWrites.agentId, agentId),
        eq(pendingFileWrites.path, path)
      )
    )
    .orderBy(desc(pendingFileWrites.enqueuedAt))
    .limit(1)
  if (latest) {
    return latest.content
  }
  const file = await getAgentMemoryFile({ agentId, path })
  return file?.content ?? ''
}
