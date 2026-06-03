import { inferenceProviderValues } from '@outname/db/schema'
import { MAX_DAILY_SCHEDULE_TIMES } from '@outname/shared/agent-schedule'
import { DEFAULT_MODEL_BY_PROVIDER } from '@outname/shared/server/inference-models'
import { DEFAULT_INFERENCE_PROVIDER } from '@outname/shared/server/inference-providers'
import { z } from 'zod'

const DEFAULT_TOOLS = { maintainer: [], subAgents: [] }

const scheduleSchema = z
  .object({
    enabled: z.boolean().describe('Whether this recurring loop is enabled.'),
    mode: z
      .enum(['interval', 'daily_times'])
      .default('interval')
      .describe(
        'Use interval for cadence or daily_times for HH:mm local times.'
      ),
    intervalMinutes: z
      .number()
      .int()
      .min(5)
      .max(1440)
      .describe('Cadence in minutes, between 5 minutes and 24 hours.'),
    times: z
      .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))
      .max(MAX_DAILY_SCHEDULE_TIMES)
      .default([])
      .describe('Daily local times in HH:mm format when mode is daily_times.'),
  })
  .superRefine((value, ctx) => {
    if (
      value.enabled &&
      value.mode === 'daily_times' &&
      value.times.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Daily schedule mode needs at least one time.',
        path: ['times'],
      })
    }
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
    .record(z.string(), z.unknown())
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
    'Per-agent USD spend caps. Sub-agent runs roll into this budget too. Tool external-service costs are not counted.'
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
    .default(DEFAULT_MODEL_BY_PROVIDER[DEFAULT_INFERENCE_PROVIDER])
    .describe('Runtime model id for the created agent.'),
  inferenceProvider: z
    .enum(inferenceProviderValues)
    .describe(
      'Inference provider for this agent. If more than one provider is configured, ask the user to choose explicitly before creating the agent.'
    ),
  heartbeat: scheduleSchema.default({
    enabled: true,
    mode: 'interval',
    intervalMinutes: 30,
    times: [],
  }),
  dreaming: z
    .object({
      enabled: z
        .boolean()
        .describe(
          'Whether dreaming is enabled. When on, the agent dreams once per local day, the first cron tick that has not run it yet.'
        ),
    })
    .default({ enabled: true }),
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
