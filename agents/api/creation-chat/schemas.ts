import { z } from 'zod'
import { DEFAULT_MODEL_ID } from '@/shared/server/ai-gateway-models'

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

const budgetLimitSchema = z
  .number()
  .positive()
  .max(100_000)
  .nullable()
  .describe('USD limit for this period, or null to skip.')

const budgetSchema = z
  .object({
    daily: budgetLimitSchema.default(null),
    weekly: budgetLimitSchema.default(null),
    monthly: budgetLimitSchema.default(null),
  })
  .default({ daily: null, weekly: null, monthly: null })
  .describe(
    'Per-agent USD spend caps. Sub-agent invocations roll into this budget too. Tool external-service costs are not counted.'
  )

export const proposeBudgetInputSchema = z.object({
  daily: budgetLimitSchema.default(null),
  weekly: budgetLimitSchema.default(null),
  monthly: budgetLimitSchema.default(null),
  rationale: z
    .string()
    .default('')
    .describe('One short sentence explaining the suggested budget.'),
})

export const createAgentInputSchema = z.object({
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
  budget: budgetSchema,
})
