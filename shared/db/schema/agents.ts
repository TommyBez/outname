import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { isNull } from 'drizzle-orm/pg-core/expressions'
import { user } from './auth'

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
    // Heartbeat opt-in and cadence; used by the ticker workflow and the
    // liveness sweeper.
    heartbeatEnabled: boolean('heartbeat_enabled').notNull().default(true),
    heartbeatIntervalMinutes: integer('heartbeat_interval_minutes')
      .notNull()
      .default(30),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    // Dreaming stays independent from proactive heartbeat work.
    dreamingEnabled: boolean('dreaming_enabled').notNull().default(true),
    dreamingIntervalMinutes: integer('dreaming_interval_minutes')
      .notNull()
      .default(1440),
    lastDreamingAt: timestamp('last_dreaming_at', { withTimezone: true }),
    // Makes "daily dreaming" mean once per local day in the owner's timezone.
    lastDreamingLocalDate: text('last_dreaming_local_date'),
    // Persistent system sandbox name. Null before first boot; after that, the
    // same sandbox is resumed on each event.
    sandboxSystemId: text('sandbox_system_id'),
    // Latest session workflow run. Used for chat streaming and liveness
    // recovery even after the run has already terminated.
    lastSessionRunId: text('last_session_run_id'),
    // Monotonic generation for session hook tokens; recovery increments it so
    // fresh sessions stop sharing a token with a stuck older run.
    sessionEpoch: integer('session_epoch').notNull().default(0),
    // Latest sibling ticker run. Persisted so a mid-handler crash leaves
    // enough forensic state for later reaping and recovery.
    lastTickerRunId: text('last_ticker_run_id'),
    // Current in-flight event marker; an old marker is a conservative sign that
    // the session wedged mid-event.
    sessionEventRunId: text('session_event_run_id'),
    sessionEventType: text('session_event_type'),
    sessionEventStartedAt: timestamp('session_event_started_at', {
      withTimezone: true,
    }),
    // Short-lived control-plane lease for starts, restarts, and recovery.
    sessionControlLeaseId: text('session_control_lease_id'),
    sessionControlLeaseUntil: timestamp('session_control_lease_until', {
      withTimezone: true,
    }),
    lastRecoveryAt: timestamp('last_recovery_at', { withTimezone: true }),
    lastRecoveryMode: text('last_recovery_mode'),
    lastRecoveryReason: text('last_recovery_reason'),
    lastRecoveryError: text('last_recovery_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('agent_user_idx').on(t.userId)]
)

// Mirror of tracked markdown files from the agent sandbox. The `(agent_id,
// path)` PK makes writes idempotent, and `sha256` lets flushes skip unchanged
// content.
export const agentFiles = pgTable(
  'agent_files',
  {
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    content: text('content').notNull(),
    sha256: text('sha256').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.agentId, t.path] }),
    index('agent_files_agent_idx').on(t.agentId),
  ]
)

// Queue of UI-authored bootstrap-file edits applied before the next event.
// Protected files bypass the tool-layer block here, and `applied_at` keeps an
// audit trail instead of deleting rows after success.
export const pendingFileWrites = pgTable(
  'pending_file_writes',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    content: text('content').notNull(),
    enqueuedAt: timestamp('enqueued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
  },
  (t) => [
    index('pending_file_writes_agent_unapplied_idx')
      .on(t.agentId)
      .where(isNull(t.appliedAt)),
  ]
)

// Post-event before/after record for tracked architecture-file edits. This
// preserves an audit trail without blocking the single-threaded session loop.
export const agentFileChanges = pgTable(
  'agent_file_changes',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    sourceType: text('source_type')
      .$type<'chat' | 'heartbeat' | 'dreaming' | 'invocation'>()
      .notNull(),
    sourceId: text('source_id'),
    beforeContent: text('before_content'),
    afterContent: text('after_content'),
    beforeSha256: text('before_sha256'),
    afterSha256: text('after_sha256'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (t) => [
    index('agent_file_changes_agent_created_idx').on(t.agentId, t.createdAt),
    index('agent_file_changes_path_idx').on(t.path),
  ]
)

export type Agent = typeof agent.$inferSelect
export type AgentFile = typeof agentFiles.$inferSelect
export type PendingFileWrite = typeof pendingFileWrites.$inferSelect
export type AgentFileChange = typeof agentFileChanges.$inferSelect
