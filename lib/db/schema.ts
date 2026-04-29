import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// Better Auth tables
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', {
    withTimezone: true,
  }),
  scope: text('scope'),
  idToken: text('idToken'),
  password: text('password'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// App tables
export const agent = pgTable(
  'agent',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Soft-delete / disable flag. Phase 1 used `enabled` as the
    // heartbeat toggle; Phase 2 splits the heartbeat opt-in into its
    // own `heartbeatEnabled` column so this can return to its
    // original meaning ("agent exists and is reachable from the UI").
    enabled: boolean('enabled').notNull().default(true),
    // AI Gateway model id, e.g. "openai/gpt-5-mini". Validated at
    // agent-action time against `getAvailableModels()` so we never
    // persist an id the gateway can't route.
    model: text('model').notNull().default('openai/gpt-5-mini'),
    // Per-agent heartbeat opt-in + cadence. Used by both the ticker
    // workflow (read once per restart) and the liveness sweeper.
    // Phase 3 lifts these onto a triggers table; for Phase 2 they
    // live on the row.
    heartbeatEnabled: boolean('heartbeat_enabled').notNull().default(true),
    heartbeatIntervalMinutes: integer('heartbeat_interval_minutes')
      .notNull()
      .default(30),
    // Persistent Vercel Sandbox ids. The system sandbox holds the
    // agent's memory volume + AGENTS.md / SOUL.md persona files;
    // the exec sandbox is a clean `/workspace` for ad-hoc bash and
    // file ops driven by exec tools. Both are NULL before the first
    // session boot; once set, subsequent boots resume the same
    // sandbox by id (Phase 1 contract preserved per role).
    sandboxSystemId: text('sandbox_system_id'),
    sandboxExecId: text('sandbox_exec_id'),
    // Workflow runtime id for the most recently started session workflow.
    // Used by the chat route (to subscribe to per-turn reply streams) and
    // by the liveness sweeper (to detect dead sessions and restart them).
    // NULL before the very first session start; afterwards always points
    // at the latest run, even if it has since terminated.
    lastSessionRunId: text('last_session_run_id'),
    // Workflow runtime id for the sibling ticker workflow that drives
    // this agent's heartbeat loop. Persisted alongside `lastSessionRunId`
    // so a session that crashes mid-handler (skipping its `finally`
    // block) leaves a forensic record we can reap on the next session
    // start and via the liveness sweeper. Cleared back to NULL when the
    // session shuts down cleanly.
    lastTickerRunId: text('last_ticker_run_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index('agent_user_idx').on(t.userId),
  })
)

export const runs = pgTable(
  'runs',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id').references(() => agent.id, {
      onDelete: 'cascade',
    }),
    workflowRunId: text('workflow_run_id'),
    status: text('status').notNull().default('running'), // running | completed | failed
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    error: text('error'),
  },
  (t) => ({
    startedAtIdx: index('runs_started_at_idx').on(t.startedAt),
    agentIdx: index('runs_agent_idx').on(t.agentId),
  })
)

/**
 * Agent-agnostic run output.
 *
 * Every completed run may attach one `run_result` row keyed by `run_id`.
 * `content` is a markdown (or plain text) document produced by the agent
 * itself — the platform does not impose any schema on what the agent
 * renders. `metrics` holds optional agent-defined per-run counts (e.g.
 * `{ emailsScanned: 12 }`) and lives on the same row so publishing a
 * result is one atomic insert.
 *
 * The PK on `run_id` gives us the "one result per run" invariant for
 * free and is the only index required — lookups are always by run id.
 */
export const runResult = pgTable('run_result', {
  runId: text('run_id')
    .primaryKey()
    .references(() => runs.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  metrics: jsonb('metrics'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Chat conversations: an agent can own many independent threads. Listing
// in the sidebar is always "newest first for this agent", so we index on
// (agent_id, updated_at DESC) to serve that exact query without a sort.
export const chatConversation = pgTable(
  'chat_conversation',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    title: text('title'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    agentUpdatedIdx: index('chat_conversation_agent_updated_idx').on(
      t.agentId,
      t.updatedAt.desc()
    ),
  })
)

// Chat messages: store full UIMessage parts array as JSONB so we keep tool
// calls, reasoning blocks, and custom data parts intact for replay.
export const chatMessage = pgTable(
  'chat_message',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => chatConversation.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // user | assistant | system
    parts: jsonb('parts').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    conversationIdx: index('chat_message_conversation_idx').on(
      t.conversationId,
      t.createdAt
    ),
  })
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
  (t) => ({
    pk: primaryKey({ columns: [t.agentId, t.path] }),
    agentIdx: index('agent_files_agent_idx').on(t.agentId),
  })
)

/**
 * Queue of UI-driven file writes that the next session event drains
 * into the agent's system sandbox before any handler runs.
 *
 * The memory tools refuse to write to `AGENTS.md` / `SOUL.md` — those
 * persona files are user-owned. Edits made via the agent settings UI
 * (Identity / Instructions tabs) land here as a row, and the
 * `drainPendingWrites` step at the top of `agentSessionWorkflow`
 * applies them via `sandbox.writeFiles`, bypassing the tool-layer
 * block. This is the one entry point that is allowed to mutate
 * persona files.
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
  (t) => ({
    unappliedIdx: index('pending_file_writes_agent_unapplied_idx')
      .on(t.agentId)
      .where(sql`${t.appliedAt} IS NULL`),
  })
)

export const gmailConnection = pgTable('gmail_connection', {
  id: text('id').primaryKey().default('singleton'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  refreshToken: text('refresh_token').notNull(),
  accessToken: text('access_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', {
    withTimezone: true,
  }),
  scopes: text('scopes').notNull(),
  status: text('status').notNull().default('active'), // active | expired | revoked
  lastError: text('last_error'),
  connectedAt: timestamp('connected_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type Run = typeof runs.$inferSelect
export type RunResult = typeof runResult.$inferSelect
export type GmailConnection = typeof gmailConnection.$inferSelect
export type Agent = typeof agent.$inferSelect
export type AgentFile = typeof agentFiles.$inferSelect
export type PendingFileWrite = typeof pendingFileWrites.$inferSelect
export type ChatConversation = typeof chatConversation.$inferSelect
export type ChatMessage = typeof chatMessage.$inferSelect
export type ChatRole = 'user' | 'assistant' | 'system'
export type RunStatus = 'running' | 'completed' | 'failed'
