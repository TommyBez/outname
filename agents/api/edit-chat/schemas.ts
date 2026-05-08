import { z } from 'zod'

export const updateSchema = z.object({
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

export const attachMaintainerToolSchema = z.object({
  toolId: z.string().min(1),
  config: z.record(z.unknown()).default({}),
})

export const attachSubAgentToolSchema = z.object({
  childAgentId: z.string().min(1),
})

export const detachToolSchema = z.object({
  toolId: z.string().min(1),
  kind: z.enum(['maintainer', 'sub_agent']).default('maintainer'),
})

const budgetLimitSchema = z
  .number()
  .positive()
  .max(100_000)
  .nullable()
  .describe('USD cap for this period, or null to clear it.')

export const proposeBudgetInputSchema = z.object({
  daily: budgetLimitSchema.default(null),
  weekly: budgetLimitSchema.default(null),
  monthly: budgetLimitSchema.default(null),
  rationale: z
    .string()
    .default('')
    .describe('Short explanation of the suggested budget.'),
})

export const setBudgetSchema = z.object({
  daily: budgetLimitSchema.default(null),
  weekly: budgetLimitSchema.default(null),
  monthly: budgetLimitSchema.default(null),
})
