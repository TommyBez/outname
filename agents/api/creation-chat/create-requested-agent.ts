import { revalidatePath, revalidateTag } from 'next/cache'
import { refreshAgentCapabilitySummary } from '@/agents/server/capability-summary'
import { createAgentForUser } from '@/agents/server/creation-service'
import type {
  AgentCreationAttachmentResult,
  AgentCreationRequest,
  AgentCreationResult,
} from '@/agents/server/creation-types'
import { upsertBudgetRule } from '@/budgets/server/rules'
import type { BudgetPeriod } from '@/budgets/server/types'
import {
  agentTag,
  agentToolsTag,
  userAgentsTag,
  userBudgetTag,
} from '@/shared/server/cache-tags'
import { attachMaintainerToolForUser } from '@/tools/server/attachment-service/maintainer'
import { attachSubAgentForUser } from '@/tools/server/attachment-service/sub-agent'
import type { AttachResult } from '@/tools/server/attachment-service/types'

export async function createRequestedAgent(input: {
  input: AgentCreationRequest
  toolCallId: string
  userId: string
}): Promise<AgentCreationResult> {
  const identityCard = resolveIdentityCard(input.input)
  const soul = resolveSoul(input.input)
  const instructions = resolveInstructions(input.input)

  const created = await createAgentForUser({
    userId: input.userId,
    idempotencyKey: input.toolCallId,
    name: input.input.name,
    model: input.input.model,
    heartbeatEnabled: input.input.heartbeat.enabled,
    heartbeatIntervalMinutes: input.input.heartbeat.intervalMinutes,
    reflectionEnabled: input.input.reflection.enabled,
    reflectionIntervalMinutes: input.input.reflection.intervalMinutes,
    stepLimitMode: input.input.stepLimit.mode,
    stepLimitCustom: input.input.stepLimit.custom,
    identityCard,
    soul,
    instructions,
    userProfile: input.input.userProfile ?? '',
  })

  const attachments = await attachRequestedTools({
    agentId: created.id,
    request: input.input,
    userId: input.userId,
  })
  await refreshAgentCapabilitySummary({
    agentId: created.id,
    bootstrap: { 'AGENTS.md': instructions },
  })
  await applyAgentBudget({
    agentId: created.id,
    userId: input.userId,
    budget: input.input.budget,
  })
  revalidateCreationSurfaces({ agentId: created.id, userId: input.userId })

  return {
    agentId: created.id,
    name: created.agent.name,
    created: created.created,
    overviewUrl: `/agents/${created.id}`,
    editUrl: `/agents/${created.id}/edit`,
    toolsUrl: `/agents/${created.id}/tools`,
    attachments,
  }
}

async function attachRequestedTools(input: {
  agentId: string
  request: AgentCreationRequest
  userId: string
}): Promise<AgentCreationAttachmentResult[]> {
  const attachments: AgentCreationAttachmentResult[] = []
  for (const selection of input.request.tools.maintainer) {
    const result = await attachMaintainerToolForUser({
      agentId: input.agentId,
      userId: input.userId,
      toolId: selection.toolId,
      rawConfig: normalizeRecord(selection.config),
      refreshSummary: false,
      revalidate: false,
    })
    attachments.push({
      kind: 'maintainer',
      toolId: selection.toolId,
      ok: result.ok,
      error: result.error,
      pendingBuildId: result.pendingBuildId,
      status: attachmentStatus(result),
    })
  }
  for (const selection of input.request.tools.subAgents) {
    const result = await attachSubAgentForUser({
      parentAgentId: input.agentId,
      childAgentId: selection.childAgentId,
      userId: input.userId,
      refreshSummary: false,
      revalidate: false,
    })
    attachments.push({
      kind: 'sub_agent',
      toolId: selection.childAgentId,
      ok: result.ok,
      error: result.error,
      status: attachmentStatus(result),
    })
  }
  return attachments
}

async function applyAgentBudget(input: {
  agentId: string
  userId: string
  budget: AgentCreationRequest['budget']
}): Promise<void> {
  const periods: Array<{
    key: 'daily' | 'weekly' | 'monthly'
    period: BudgetPeriod
  }> = [
    { key: 'daily', period: 'daily' },
    { key: 'weekly', period: 'weekly' },
    { key: 'monthly', period: 'monthly' },
  ]
  for (const { key, period } of periods) {
    const limit = input.budget?.[key]
    if (typeof limit !== 'number' || limit <= 0) {
      continue
    }
    try {
      await upsertBudgetRule({
        userId: input.userId,
        agentId: input.agentId,
        period,
        limitUsd: limit,
      })
    } catch (err) {
      console.error('[v0] applyAgentBudget: failed to persist rule', {
        period,
        err,
      })
    }
  }
}

function resolveIdentityCard(input: AgentCreationRequest): string {
  const explicit = input.identityCard?.trim()
  if (explicit) {
    return explicit
  }
  return [
    `You are ${input.name}.`,
    `Role: ${input.role}`,
    `Behavior: ${input.behavior}`,
  ].join('\n')
}

function resolveSoul(input: AgentCreationRequest): string {
  const explicit = input.soul?.trim()
  if (explicit) {
    return explicit
  }
  return [
    `# ${input.name} Persona`,
    '',
    '## Role',
    input.role,
    '',
    '## Behavior',
    input.behavior,
  ].join('\n')
}

function resolveInstructions(input: AgentCreationRequest): string {
  const explicit = input.instructions?.trim()
  if (explicit) {
    return explicit
  }
  return [
    `# ${input.name} Custom Instructions`,
    '',
    '## Role',
    input.role,
    '',
    '## Behavior',
    input.behavior,
    '',
    '## Heartbeat',
    input.heartbeat.enabled
      ? `Wake every ${input.heartbeat.intervalMinutes} minutes and perform one useful, bounded action aligned with the role.`
      : 'Do not run proactive heartbeat work unless the user enables it later.',
    '',
    '## Reflection',
    input.reflection.enabled
      ? `Review memory and recent work every ${input.reflection.intervalMinutes} minutes.`
      : 'Do not run scheduled reflection unless the user enables it later.',
    '',
    '## Tool Use',
    toolInstruction(input),
  ].join('\n')
}

function toolInstruction(input: AgentCreationRequest): string {
  const maintainer = input.tools.maintainer.map((t) => `- ${t.toolId}`)
  const subAgents = input.tools.subAgents.map(
    (t) => `- agent:${t.childAgentId}`
  )
  const lines = [...maintainer, ...subAgents]
  if (lines.length === 0) {
    return 'No optional tools are attached at creation. Use built-in memory and exec tools carefully.'
  }
  return ['Attached optional tools:', ...lines].join('\n')
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function attachmentStatus(
  result: AttachResult
): AgentCreationAttachmentResult['status'] {
  if (!result.ok) {
    return 'failed'
  }
  if (result.pendingBuildId) {
    return 'pending'
  }
  return 'connected'
}

function revalidateCreationSurfaces(input: {
  agentId: string
  userId: string
}): void {
  revalidateTag(userAgentsTag(input.userId), 'max')
  revalidateTag(agentTag(input.agentId), 'max')
  revalidateTag(agentToolsTag(input.agentId), 'max')
  revalidateTag(userBudgetTag(input.userId), 'max')
  revalidatePath('/agents')
  revalidatePath(`/agents/${input.agentId}`)
  revalidatePath('/')
}
