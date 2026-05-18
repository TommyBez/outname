import { z } from 'zod'
import { MAX_DAILY_SCHEDULE_TIMES } from '@/shared/agent-schedule'

const scheduleModeSchema = z.enum(['interval', 'daily_times'])
const scheduleTimesSchema = z
  .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))
  .max(MAX_DAILY_SCHEDULE_TIMES)
  .default([])

export const updateSchema = z
  .object({
    name: z.string().min(1),
    model: z.string().min(1),
    heartbeatEnabled: z.boolean(),
    heartbeatScheduleMode: scheduleModeSchema.default('interval'),
    heartbeatScheduleTimes: scheduleTimesSchema,
    heartbeatIntervalMinutes: z.number().int().min(5).max(1440),
    dreamingEnabled: z.boolean(),
    stepLimitMode: z.enum(['custom', 'grind', 'high', 'low', 'medium']),
    stepLimitCustom: z.number().int().min(1).nullable(),
    identityCard: z.string(),
    soul: z.string(),
    instructions: z.string(),
    userProfile: z.string(),
  })
  .superRefine((value, ctx) => {
    if (
      value.heartbeatEnabled &&
      value.heartbeatScheduleMode === 'daily_times' &&
      value.heartbeatScheduleTimes.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Heartbeat daily schedule needs at least one time.',
        path: ['heartbeatScheduleTimes'],
      })
    }
  })

export const attachMaintainerToolSchema = z.object({
  toolId: z.string().min(1),
  config: z.record(z.string(), z.unknown()).default({}),
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
