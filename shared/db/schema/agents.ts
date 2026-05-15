import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { AgentScheduleMode } from '@/shared/agent-schedule'
import { user } from './auth'

export type AgentEventStatus =
  | 'queued'
  | 'starting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type AgentEventType = 'chat' | 'heartbeat' | 'dreaming' | 'invocation'

export type AgentEventSource =
  | 'chat'
  | 'slack'
  | 'scheduler'
  | 'manual'
  | 'invocation'

export const agent = pgTable(
  'agent',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    capabilitySummary: text('capability_summary'),
    // Soft-delete / UI reachability flag. Heartbeat opt-in lives on
    // `heartbeatEnabled`, so disabling heartbeat no longer hides the agent.
    enabled: boolean('enabled').notNull().default(true),
    // Persist only model ids the AI Gateway can route.
    model: text('model').notNull().default('openai/gpt-5-mini'),
    // Per-agent model-step budget for `stopWhen` guards.
    stepLimitMode: text('step_limit_mode').notNull().default('medium'),
    stepLimitCustom: integer('step_limit_custom'),
    // Heartbeat opt-in and cadence; used by the scheduler cron.
    heartbeatEnabled: boolean('heartbeat_enabled').notNull().default(true),
    heartbeatScheduleMode: text('heartbeat_schedule_mode')
      .$type<AgentScheduleMode>()
      .notNull()
      .default('interval'),
    heartbeatScheduleTimes: jsonb('heartbeat_schedule_times')
      .$type<string[]>()
      .notNull()
      .default([]),
    heartbeatIntervalMinutes: integer('heartbeat_interval_minutes')
      .notNull()
      .default(30),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    // Dreaming stays independent from proactive heartbeat work.
    dreamingEnabled: boolean('dreaming_enabled').notNull().default(true),
    dreamingScheduleMode: text('dreaming_schedule_mode')
      .$type<AgentScheduleMode>()
      .notNull()
      .default('interval'),
    dreamingScheduleTimes: jsonb('dreaming_schedule_times')
      .$type<string[]>()
      .notNull()
      .default([]),
    dreamingIntervalMinutes: integer('dreaming_interval_minutes')
      .notNull()
      .default(1440),
    lastDreamingAt: timestamp('last_dreaming_at', { withTimezone: true }),
    // Makes "daily dreaming" mean once per local day in the owner's timezone.
    lastDreamingLocalDate: text('last_dreaming_local_date'),
    // Persistent system sandbox name. Null before first boot; after that, the
    // same sandbox is resumed on each event.
    sandboxSystemId: text('sandbox_system_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('agent_user_idx').on(t.userId)]
)

export const agentEvents = pgTable(
  'agent_events',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').$type<AgentEventType>().notNull(),
    source: text('source').$type<AgentEventSource>().notNull(),
    status: text('status').$type<AgentEventStatus>().notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    concurrencyKey: text('concurrency_key'),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    attempt: integer('attempt').notNull().default(0),
    workflowRunId: text('workflow_run_id'),
    publisherWorkflowRunId: text('publisher_workflow_run_id'),
    queuedAt: timestamp('queued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }),
    claimExpiresAt: timestamp('claim_expires_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('agent_events_idempotency_idx').on(t.idempotencyKey),
    uniqueIndex('agent_events_active_concurrency_idx')
      .on(t.concurrencyKey)
      .where(
        sql`concurrency_key IS NOT NULL AND status in ('starting', 'running')`
      ),
    index('agent_events_agent_status_idx').on(t.agentId, t.status, t.queuedAt),
    index('agent_events_user_status_idx').on(t.userId, t.status, t.queuedAt),
    index('agent_events_concurrency_status_idx').on(
      t.concurrencyKey,
      t.status,
      t.queuedAt
    ),
    index('agent_events_scheduled_idx').on(t.scheduledFor, t.status),
  ]
)

export type Agent = typeof agent.$inferSelect
export type AgentEvent = typeof agentEvents.$inferSelect
