import {
  createAgentUIStreamResponse,
  stepCountIs,
  ToolLoopAgent,
  tool,
  type UIMessage,
} from 'ai'
import { revalidatePath, revalidateTag } from 'next/cache'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getConnector } from '@/connectors/registry'
import { refreshAgentCapabilitySummary } from '@/lib/agent-capability-summary'
import { createAgentForUser } from '@/lib/agent-creation-service'
import type {
  AgentCreationAttachmentResult,
  AgentCreationRequest,
  AgentCreationResult,
} from '@/lib/agent-creation-types'
import {
  type AttachResult,
  attachMaintainerToolForUser,
  attachSubAgentForUser,
} from '@/lib/agent-tool-attachment-service'
import { DEFAULT_MODEL_ID } from '@/lib/ai-gateway-models'
import { auth } from '@/lib/auth'
import { agentTag, agentToolsTag, userAgentsTag } from '@/lib/cache-tags'
import { getAgentsForUser, getUserConnections } from '@/lib/data'
import { describeConfigSchema } from '@/lib/zod-config-fields'
import { listMaintainerTools } from '@/tools/registry'

const CREATOR_MODEL = 'deepseek/deepseek-v4-flash'
const DEFAULT_TOOLS = { maintainer: [], subAgents: [] }

const scheduleSchema = z.object({
  enabled: z.boolean().describe('Whether this recurring loop is enabled.'),
  intervalMinutes: z
    .number()
    .int()
    .min(5)
    .max(1440)
    .describe('Cadence in minutes, between 5 minutes and 24 hours.'),
})

const stepLimitSchema = z.object({
  mode: z
    .enum(['low', 'medium', 'high', 'custom', 'grind'])
    .describe('The per-run tool/model step budget mode.'),
  custom: z
    .number()
    .int()
    .min(1)
    .nullable()
    .describe('Required only when mode is custom; otherwise null.'),
})

const maintainerToolSelectionSchema = z.object({
  toolId: z
    .string()
    .describe('Exact maintainer tool id from list_available_tools.'),
  config: z
    .record(z.unknown())
    .default({})
    .describe('Per-attachment config matching that tool config schema.'),
  reason: z
    .string()
    .default('')
    .describe('Short reason this tool belongs on the agent.'),
})

const subAgentSelectionSchema = z.object({
  childAgentId: z
    .string()
    .describe('Existing user-owned agent id to attach as a sub-agent.'),
  reason: z
    .string()
    .default('')
    .describe('Short reason this sub-agent should be available.'),
})

const createAgentInputSchema = z.object({
  requestId: z
    .string()
    .min(3)
    .max(80)
    .default('agent-creation-request')
    .describe('Stable short id for this final configuration.'),
  name: z.string().min(1).max(120).describe('Agent display name.'),
  role: z.string().min(1).describe('The job this agent is responsible for.'),
  behavior: z
    .string()
    .min(1)
    .describe('Tone, working style, boundaries, and habits.'),
  identityCard: z
    .string()
    .default('')
    .describe('Optional concise IDENTITY.md content.'),
  soul: z.string().default('').describe('Optional long-form SOUL.md content.'),
  instructions: z
    .string()
    .default('')
    .describe(
      'Optional custom operating instructions appended below the platform AGENTS.md template.'
    ),
  userProfile: z
    .string()
    .default('')
    .describe('Optional USER.md seed about the owner.'),
  model: z
    .string()
    .default(DEFAULT_MODEL_ID)
    .describe('Runtime model id for the created agent.'),
  heartbeat: scheduleSchema.default({
    enabled: true,
    intervalMinutes: 30,
  }),
  reflection: scheduleSchema.default({
    enabled: true,
    intervalMinutes: 1440,
  }),
  stepLimit: stepLimitSchema.default({
    mode: 'medium',
    custom: null,
  }),
  tools: z
    .object({
      maintainer: z.array(maintainerToolSelectionSchema).default([]),
      subAgents: z.array(subAgentSelectionSchema).default([]),
    })
    .default(DEFAULT_TOOLS),
})

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
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

  const agent = new ToolLoopAgent({
    model: CREATOR_MODEL,
    instructions: creatorInstructions(),
    stopWhen: stepCountIs(8),
    tools: {
      list_available_tools: tool({
        description:
          'List maintainer tools, tool config requirements, user connections, and attachable sub-agents before suggesting tools.',
        inputSchema: z.object({}),
        execute: async () => listAvailableTools(session.user.id),
      }),
      create_requested_agent: tool({
        description:
          'Create the reviewed agent after the user approves the final configuration. This mutates the database and attaches selected tools.',
        inputSchema: createAgentInputSchema,
        needsApproval: true,
        execute: async (input, options) =>
          createRequestedAgent({
            input,
            toolCallId: options.toolCallId,
            userId: session.user.id,
          }),
      }),
    },
  })

  return createAgentUIStreamResponse({
    agent,
    uiMessages: body.messages,
  })
}

function creatorInstructions(): string {
  return [
    'You are the OUTNA.ME agent creation assistant.',
    '',
    'Your job is to interview the user and produce a complete agent configuration.',
    'Ask concise questions about role, behavior, boundaries, proactive heartbeat work, reflection, memory seeds, runtime model, and tools.',
    'Ask one or two high-impact questions at a time. Prefer sensible defaults when the user is indifferent.',
    '',
    'Before suggesting tools, call list_available_tools. Suggest exact tool ids only from that result, and explain why each tool is useful.',
    'If a tool requires configuration, gather the required fields before final creation.',
    'If a tool requires a provider connection that is missing, say it can be attached now but may need connection setup later.',
    '',
    'When the configuration is complete, call create_requested_agent with the complete final config. The app will render an approval UI from the tool call; do not ask the user to type a magic confirmation phrase.',
    'If the user denies the approval, do not retry the same create_requested_agent call. Ask what they want changed.',
    '',
    'For bootstrap files, write practical markdown. Keep IDENTITY.md compact, SOUL.md behavioral, and USER.md only for stable facts the user provided.',
    'The instructions field is NOT the full AGENTS.md file. It is only the user custom instructions block appended below the platform AGENTS.md template from lib/agents-md-template.ts.',
    `Default runtime model for created agents: ${DEFAULT_MODEL_ID}. The creator assistant itself is running on ${CREATOR_MODEL}.`,
  ].join('\n')
}

async function listAvailableTools(userId: string) {
  const [connectionRows, agents] = await Promise.all([
    getUserConnections(userId),
    getAgentsForUser(userId),
  ])
  const connectionByProvider = new Map(
    connectionRows.map((row) => [row.provider, row])
  )

  return {
    maintainerTools: listMaintainerTools().map((t) => {
      const providers = t.capabilities
        .filter((capability) => capability.kind === 'brokered_http')
        .map((capability) => capability.provider)
      return {
        toolId: t.id,
        displayName: t.displayName,
        category: t.category,
        description: t.description,
        configFields: describeConfigSchema(t.configSchema),
        providers: providers.map((provider) => {
          const connector = getConnector(provider)
          const connection = connectionByProvider.get(provider)
          return {
            provider,
            displayName: connector?.displayName ?? provider,
            status: connection?.status ?? null,
          }
        }),
        toolSandboxManifest:
          t.capabilities.find(
            (capability) => capability.kind === 'tool_sandbox'
          )?.manifest ?? null,
      }
    }),
    subAgents: agents.map((row) => ({
      agentId: row.id,
      name: row.name,
      enabled: row.enabled,
      model: row.model,
      capabilitySummary: row.capabilitySummary,
    })),
  }
}

async function createRequestedAgent(input: {
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

  const attachments: AgentCreationAttachmentResult[] = []

  for (const selection of input.input.tools.maintainer) {
    const result = await attachMaintainerToolForUser({
      agentId: created.id,
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

  for (const selection of input.input.tools.subAgents) {
    const result = await attachSubAgentForUser({
      parentAgentId: created.id,
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

  await refreshAgentCapabilitySummary({
    agentId: created.id,
    bootstrap: { 'AGENTS.md': instructions },
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
  revalidatePath('/agents')
  revalidatePath(`/agents/${input.agentId}`)
  revalidatePath('/')
}
