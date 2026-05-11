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

// App tables
export const agent = pgTable(
  'agent',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    capabilitySummary: text('capability_summary'),
    // Soft-delete / disable flag. Phase 1 used `enabled` as the
    // heartbeat toggle; Phase 2 splits the heartbeat opt-in into its
    // own `heartbeatEnabled` column so this can return to its
    // original meaning ("agent exists and is reachable from the UI").
    enabled: boolean('enabled').notNull().default(true),
    // AI Gateway model id, e.g. "openai/gpt-5-mini". Validated at
    // agent-action time against `getAvailableModels()` so we never
    // persist an id the gateway can't route.
    model: text('model').notNull().default('openai/gpt-5-mini'),
    // Per-agent model-step budget. Used to build `stopWhen` guards for
    // chat/heartbeat/reflection/invocation streams.
    stepLimitMode: text('step_limit_mode').notNull().default('medium'),
    stepLimitCustom: integer('step_limit_custom'),
    // Per-agent heartbeat opt-in + cadence. Used by both the ticker
    // workflow (read once per restart) and the liveness sweeper.
    // Phase 3 lifts these onto a triggers table; for Phase 2 they
    // live on the row.
    heartbeatEnabled: boolean('heartbeat_enabled').notNull().default(true),
    heartbeatIntervalMinutes: integer('heartbeat_interval_minutes')
      .notNull()
      .default(30),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    // Reflection is independent from normal heartbeat. An agent can
    // keep daily self-review active even when proactive work is off.
    reflectionEnabled: boolean('reflection_enabled').notNull().default(true),
    reflectionIntervalMinutes: integer('reflection_interval_minutes')
      .notNull()
      .default(1440),
    lastReflectionAt: timestamp('last_reflection_at', { withTimezone: true }),
    // Local date in the owning user's timezone for the last completed
    // reflection. Used to make "daily" mean once per local day.
    lastReflectionLocalDate: text('last_reflection_local_date'),
    // Persistent Vercel Sandbox id for the agent's system sandbox —
    // the memory volume + eager bootstrap files. NULL before the
    // first session boot; once set, subsequent boots resume the same
    // sandbox by name.
    sandboxSystemId: text('sandbox_system_id'),
    // Workflow runtime id for the most recently started session workflow.
    // Used by the chat route (to subscribe to per-turn reply streams) and
    // by the liveness sweeper (to detect dead sessions and restart them).
    // NULL before the very first session start; afterwards always points
    // at the latest run, even if it has since terminated.
    lastSessionRunId: text('last_session_run_id'),
    // Monotonic control-plane generation for session hook tokens. Force
    // recovery increments this value so new sessions stop sharing a hook token
    // with a stuck old workflow run.
    sessionEpoch: integer('session_epoch').notNull().default(0),
    // Workflow runtime id for the sibling ticker workflow that drives
    // this agent's heartbeat loop. Persisted alongside `lastSessionRunId`
    // so a session that crashes mid-handler (skipping its `finally`
    // block) leaves a forensic record we can reap on the next session
    // start and via the liveness sweeper. Cleared back to NULL when the
    // session shuts down cleanly.
    lastTickerRunId: text('last_ticker_run_id'),
    // Marker for the event currently being handled by the session workflow.
    // The liveness sweeper treats an old marker on the current session run as
    // a conservative signal that the session is wedged mid-event.
    sessionEventRunId: text('session_event_run_id'),
    sessionEventType: text('session_event_type'),
    sessionEventStartedAt: timestamp('session_event_started_at', {
      withTimezone: true,
    }),
    // Short-lived lease used by starts/restarts/recovery so multiple
    // interfaces do not start competing session generations.
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

/**
 * Cache of every markdown document the agent maintains inside its
 * sandbox. Flushed at the end of each session event (chat turn /
 * heartbeat) so the UI can render the agent's evolving notes without
 * having to resume the sandbox.
 *
 * Keyed by `(agent_id, path)` so writes are idempotent upserts and the
 * full set of files for one agent is a single index range scan.
 * `sha256` lets the flush step skip rewriting unchanged files.
 */
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

/**
 * Queue of UI-driven file writes that the next session event drains
 * into the agent's system sandbox before any handler runs.
 *
 * writeFile refuses to write to `AGENTS.md`, `IDENTITY.md`, and
 * `SOUL.md` — those protected bootstrap files are user-owned. Edits
 * made via the agent settings UI (Identity card / Persona /
 * Instructions / User profile tabs) land here as a row, and the
 * `drainPendingWrites` step at the top of `agentSessionWorkflow`
 * applies them via `sandbox.writeFiles`, bypassing the tool-layer
 * block for protected files. `USER.md` is included as a manual
 * seed/correction path, while the agent may also update it with writeFile.
 *
 * Rows are not deleted after application — `applied_at` is set so the
 * UI can show audit history later. The partial index narrows the
 * common "anything still queued?" lookup to a tiny tail.
 */
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

/**
 * Reviewable architecture-file deltas captured at the end of an event.
 *
 * The agent writes tracked architecture files directly through writeFile.
 * This table keeps a post-event before/after record so the UI can show
 * what changed without introducing a blocking approval gate into the
 * single-threaded session loop.
 */
export const agentFileChanges = pgTable(
  'agent_file_changes',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    sourceType: text('source_type')
      .$type<'chat' | 'heartbeat' | 'reflection' | 'invocation'>()
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
