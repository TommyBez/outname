import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { isNull } from 'drizzle-orm/pg-core/expressions'

// Better Auth tables
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  name: text('name'),
  image: text('image'),
  timezone: text('timezone').notNull().default('UTC'),
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
    // Persistent Vercel Sandbox ids. The system sandbox holds the
    // agent's memory volume + eager bootstrap files;
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
    // Short-lived compare-and-swap lease used while starting/restarting
    // the session workflow. Prevents simultaneous chat/heartbeat
    // callers from starting duplicate runs for the same agent.
    sessionStartToken: text('session_start_token'),
    sessionStartExpiresAt: timestamp('session_start_expires_at', {
      withTimezone: true,
    }),
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
  (t) => [index('agent_user_idx').on(t.userId)]
)

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
  (t) => [
    index('chat_conversation_agent_updated_idx').on(
      t.agentId,
      t.updatedAt.desc()
    ),
  ]
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
  (t) => [
    index('chat_message_conversation_idx').on(t.conversationId, t.createdAt),
  ]
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
 * The memory tools refuse to write to `AGENTS.md`, `IDENTITY.md`, and
 * `SOUL.md` — those protected bootstrap files are user-owned. Edits
 * made via the agent settings UI (Identity card / Persona /
 * Instructions / User profile tabs) land here as a row, and the
 * `drainPendingWrites` step at the top of `agentSessionWorkflow`
 * applies them via `sandbox.writeFiles`, bypassing the tool-layer
 * block for protected files. `USER.md` is included as a manual
 * seed/correction path, while agent memory tools may also update it.
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
 * Reviewable memory-file deltas captured at the end of an event.
 *
 * The agent writes `DREAMS.md`, `GOALS.md`, `TASKS.md`, and logs directly
 * through memory tools. This table keeps a post-event before/after record
 * so the UI can show what changed without introducing a blocking approval
 * gate into the single-threaded session loop.
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

/**
 * Generic per-(user, provider) API-key credential store. Replaces the
 * bespoke `gmail_connection` table from Phase 2.
 *
 * `credentials` is a base64-encoded AES-256-GCM envelope produced by
 * `lib/connection-crypto.ts`. Plaintext shape is opaque to the platform —
 * each connector defines its own.
 *
 * `metadata` is connector-defined free-form status context. API keys
 * do not get read by the UI, only decrypted inside the tool runtime.
 *
 * `status` lifecycle is owned by `connectors/runtime.ts`:
 *   active   ←   API key validates and saves
 *   invalid  ←   stored credential cannot be decrypted
 */
export const userConnections = pgTable(
  'user_connections',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    credentials: text('credentials').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    status: text('status').notNull().default('active'), // active | invalid
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.provider] }),
    index('user_connections_user_idx').on(t.userId),
  ]
)

/**
 * Agent's attached maintainer tools. One row per (agent, tool); `tool_id`
 * is the registry id (e.g. "resend_send"). `config` is validated
 * against the maintainer tool's `configSchema` at attach time and at
 * every event boot — drift surfaces as `reason: "config_invalid"` in the
 * reconnects channel rather than crashing.
 */
export const agentTools = pgTable(
  'agent_tools',
  {
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    toolId: text('tool_id').notNull(),
    kind: text('kind')
      .$type<'maintainer' | 'sub_agent'>()
      .notNull()
      .default('maintainer'),
    config: jsonb('config').notNull().default({}),
    /**
     * Phase 4: lifecycle of the attachment.
     *
     *   - `connected`           — usable this turn.
     *   - `pending`             — the tool depends on a tool sandbox
     *                             that's still being built; flipped to
     *                             `connected` by `markBuildReady` when
     *                             the build workflow finishes.
     */
    status: text('status').notNull().default('connected'),
    /**
     * Phase 4: id of the `tool_sandbox_snapshots` manifest this
     * attachment depends on, or NULL for tools that don't need a
     * sandbox (e.g. resend_send).
     *
     * Stored on the row so:
     *   - `markBuildReady` can flip every pending row for a manifest
     *     in one UPDATE,
     *   - `resolveToolPlan` can decide whether to render
     *     `tool_sandbox_building` reconnects without re-loading the
     *     registry.
     */
    toolSandboxManifest: text('tool_sandbox_manifest'),
    toolSandboxManifestHash: text('tool_sandbox_manifest_hash'),
    /**
     * Phase 4: most recent sticky build error for this manifest, if
     * any. Cleared on the next successful build. UI shows it next to
     * the Retry button.
     */
    toolSandboxError: text('tool_sandbox_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.agentId, t.kind, t.toolId] }),
    index('agent_tools_agent_idx').on(t.agentId),
    index('agent_tools_sandbox_manifest_idx').on(t.toolSandboxManifest),
    index('agent_tools_kind_idx').on(t.kind),
  ]
)

/**
 * Phase 4: tool-sandbox snapshots.
 *
 * One row per manifest holding the most recent READY snapshot id and
 * the manifest hash that produced it. The runtime reads this table at
 * tool-call time to spawn a sandbox from the snapshot.
 *
 * Global (not user-scoped): one snapshot per manifest serves every
 * user that has attached a tool requiring it.
 */
export const toolSandboxSnapshots = pgTable('tool_sandbox_snapshots', {
  manifestId: text('manifest_id').primaryKey(),
  snapshotId: text('snapshot_id').notNull(),
  manifestHash: text('manifest_hash').notNull(),
  builtAt: timestamp('built_at', { withTimezone: true }).notNull().defaultNow(),
})
export type ToolSandboxSnapshot = typeof toolSandboxSnapshots.$inferSelect

/**
 * Phase 4: in-flight + completed build attempts.
 *
 * One row per `attachToolAction` invocation that didn't hit the
 * cached-snapshot fast path. Builds for the same `(manifestId,
 * manifestHash)` are coalesced — concurrent attaches share the same
 * row so we only run one workflow per build.
 *
 * Only **terminal** state is stored here. Per-step progress messages
 * are published to the build workflow's per-run stream and read back
 * by clients via `/api/tool-sandbox-builds/[buildId]/stream`.
 */
export const toolSandboxBuilds = pgTable(
  'tool_sandbox_builds',
  {
    id: text('id').primaryKey(),
    manifestId: text('manifest_id').notNull(),
    manifestHash: text('manifest_hash').notNull(),
    status: text('status')
      .$type<'pending' | 'running' | 'ready' | 'failed'>()
      .notNull(),
    workflowRunId: text('workflow_run_id'),
    errorText: text('error_text'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    index('tool_sandbox_builds_manifest_status_idx').on(t.manifestId, t.status),
    uniqueIndex('tool_sandbox_builds_active_unique_idx')
      .on(t.manifestId, t.manifestHash)
      .where(sql`status in ('pending', 'running')`),
  ]
)
export type ToolSandboxBuild = typeof toolSandboxBuilds.$inferSelect

/**
 * PII-light maintainer tool audit trail.
 *
 * Payloads and provider responses are intentionally omitted. The row is
 * meant for forensics, debugging, and coarse product metrics without
 * persisting user/tool content.
 */
export const toolInvocations = pgTable(
  'tool_invocations',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    runId: text('run_id'),
    conversationId: text('conversation_id'),
    toolId: text('tool_id').notNull(),
    kind: text('kind').notNull(),
    ok: boolean('ok').notNull(),
    durationMs: integer('duration_ms').notNull(),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('tool_invocations_agent_created_idx').on(
      t.agentId,
      t.createdAt.desc()
    ),
    index('tool_invocations_user_created_idx').on(t.userId, t.createdAt.desc()),
    index('tool_invocations_tool_created_idx').on(t.toolId, t.createdAt.desc()),
  ]
)
export type ToolInvocation = typeof toolInvocations.$inferSelect

/**
 * External chat-channel installations (Slack workspace, Teams tenant,
 * Discord guild, …). One row per (user, channel, externalId).
 *
 * Credentials are encrypted with the same envelope used for
 * `user_connections`. `metadata` carries channel-specific state that is
 * safe to read in the clear (bot user id, team name, app id).
 *
 * Status lifecycle:
 *   active   ←   installation works
 *   revoked  ←   operator removed the install or token was rotated out
 */
export const channelInstallations = pgTable(
  'channel_installations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    externalId: text('external_id').notNull(),
    credentials: text('credentials'),
    metadata: jsonb('metadata').notNull().default({}),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('channel_installations_unique_idx').on(
      t.userId,
      t.channel,
      t.externalId
    ),
    index('channel_installations_channel_idx').on(t.channel),
  ]
)

/**
 * Budget rules. Two layers:
 *
 *   - **General** (`agent_id IS NULL`): caps total spend across every
 *     agent owned by the user.
 *   - **Per-agent** (`agent_id IS NOT NULL`): caps spend attributed to
 *     that single agent.
 *
 * Three time dimensions per layer: `daily` | `weekly` | `monthly`.
 * Limit is stored as USD with 6 fractional digits — enough to express
 * sub-cent amounts that show up when very small models are involved.
 *
 * Sub-agent invocations are attributed to the **root** agent the user
 * invoked, so a child's spend lands in the parent's bucket. Tools that
 * call out to external services (Resend, Gmail, etc.) are deliberately
 * NOT counted yet — only AI Gateway model spend.
 *
 * The unique index forces at most one rule per `(user, scope, period)`
 * — there's no use case for two competing daily caps on the same
 * agent.
 */
export const budgetRule = pgTable(
  'budget_rule',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** NULL means "general" budget covering every agent for this user. */
    agentId: text('agent_id').references(() => agent.id, {
      onDelete: 'cascade',
    }),
    period: text('period').$type<'daily' | 'weekly' | 'monthly'>().notNull(),
    /** USD with 6 decimal places. Stored as text by drizzle's `numeric`. */
    limitUsd: numeric('limit_usd', { precision: 12, scale: 6 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('budget_rule_user_idx').on(t.userId),
    index('budget_rule_agent_idx').on(t.agentId),
    uniqueIndex('budget_rule_user_general_period_unique_idx')
      .on(t.userId, t.period)
      .where(sql`agent_id IS NULL`),
    uniqueIndex('budget_rule_user_agent_period_unique_idx')
      .on(t.userId, t.agentId, t.period)
      .where(sql`agent_id IS NOT NULL`),
  ]
)

/**
 * Routes incoming external messages to a specific agent. Resolved at
 * webhook time by `(channel, teamId, externalKey, kind)`.
 *
 * - `teamId`            — workspace dimension (Slack team id, Teams
 *                         tenant id, Discord guild id). Required even
 *                         for channels that don't have a workspace
 *                         concept; use `''` as a sentinel in that case.
 * - `kind = 'channel'`  — a Slack channel id, Teams channel id, …
 * - `kind = 'dm'`       — a Slack user id (when DMing the bot)
 * - `kind = 'default'`  — fallback for any unbound thread within this
 *                         workspace; externalKey is ''
 */
export const agentChannelBindings = pgTable(
  'agent_channel_bindings',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    teamId: text('team_id').notNull().default(''),
    externalKey: text('external_key').notNull(),
    kind: text('kind').$type<'channel' | 'dm' | 'default'>().notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('agent_channel_bindings_lookup_idx').on(
      t.channel,
      t.teamId,
      t.externalKey,
      t.kind
    ),
    index('agent_channel_bindings_agent_idx').on(t.agentId),
  ]
)

/**
 * Maps an external thread (Slack channel+thread_ts, Teams reply chain,
 * Discord thread) to a `chat_conversation` row owned by an agent.
 *
 * One external thread within a single workspace maps to exactly one
 * conversation, so the agent's existing chat history, memory, and tool
 * runtime are reused regardless of which surface (web UI, Slack, …)
 * the message arrived from.
 */
export const channelThreadConversations = pgTable(
  'channel_thread_conversations',
  {
    id: text('id').primaryKey(),
    channel: text('channel').notNull(),
    teamId: text('team_id').notNull().default(''),
    externalThreadKey: text('external_thread_key').notNull(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => chatConversation.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('channel_thread_conversations_external_idx').on(
      t.channel,
      t.teamId,
      t.externalThreadKey
    ),
    index('channel_thread_conversations_conversation_idx').on(t.conversationId),
    index('channel_thread_conversations_agent_idx').on(t.agentId),
  ]
)

/**
 * Per-stream token usage ledger. One row per `agent.stream()` call
 * (chat, heartbeat, reflection, sub-agent invocation). Cost is
 * computed at write time using the AI Gateway pricing snapshot — we
 * persist USD and the input/output rates so a later pricing change
 * doesn't retroactively rewrite history.
 *
 * `rootAgentId` is the agent the operator originally invoked. For
 * top-level events it equals `agentId`; for sub-agent invocations it
 * is `callStack[0]`. Budget queries always sum on `rootAgentId` so
 * sub-agent spend lands in the parent agent's bucket, per spec.
 *
 * The `(user_id, created_at)` and `(root_agent_id, created_at)`
 * indexes serve the two budget-rollup queries directly: SUM over a
 * rolling time window for general and per-agent rules respectively.
 */
export const agentTokenUsage = pgTable(
  'agent_token_usage',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    /**
     * Agent the operator invoked. Equals `agentId` for normal turns;
     * for sub-agent invocations, it's the root of the call stack.
     */
    rootAgentId: text('root_agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    sourceType: text('source_type')
      .$type<'chat' | 'heartbeat' | 'reflection' | 'invocation'>()
      .notNull(),
    /** runId / conversationId / streamToken — informational only. */
    sourceId: text('source_id'),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    /**
     * Reasoning tokens reported separately by some providers (already
     * priced as output by most gateways, kept here for forensics).
     */
    reasoningTokens: integer('reasoning_tokens').notNull().default(0),
    cachedInputTokens: integer('cached_input_tokens').notNull().default(0),
    /** Sum of input + output (mirrors AI SDK `LanguageModelUsage.totalTokens`). */
    totalTokens: bigint('total_tokens', { mode: 'number' })
      .notNull()
      .default(0),
    /** USD cost of this stream, accurate to 1e-9 dollars. */
    costUsd: numeric('cost_usd', { precision: 14, scale: 9 })
      .notNull()
      .default('0'),
    /** Snapshot of the per-token rates used to compute `costUsd`. */
    inputRateUsdPerToken: numeric('input_rate_usd_per_token', {
      precision: 14,
      scale: 12,
    }),
    outputRateUsdPerToken: numeric('output_rate_usd_per_token', {
      precision: 14,
      scale: 12,
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('agent_token_usage_user_created_idx').on(
      t.userId,
      t.createdAt.desc()
    ),
    index('agent_token_usage_root_agent_created_idx').on(
      t.rootAgentId,
      t.createdAt.desc()
    ),
    index('agent_token_usage_agent_created_idx').on(
      t.agentId,
      t.createdAt.desc()
    ),
  ]
)

export type BudgetRule = typeof budgetRule.$inferSelect
export type BudgetPeriod = 'daily' | 'weekly' | 'monthly'
export type AgentTokenUsage = typeof agentTokenUsage.$inferSelect

export type UserConnection = typeof userConnections.$inferSelect
export type AgentTool = typeof agentTools.$inferSelect
export type AgentFileChange = typeof agentFileChanges.$inferSelect
export type AgentToolStatus = 'connected' | 'pending'
export type AgentToolKind = 'maintainer' | 'sub_agent'
export type Agent = typeof agent.$inferSelect
export type AgentFile = typeof agentFiles.$inferSelect
export type PendingFileWrite = typeof pendingFileWrites.$inferSelect
export type ChatConversation = typeof chatConversation.$inferSelect
export type ChatMessage = typeof chatMessage.$inferSelect
export type ChatRole = 'user' | 'assistant' | 'system'
export type ConnectionStatus = 'active' | 'invalid'
export type ChannelInstallation = typeof channelInstallations.$inferSelect
export type AgentChannelBinding = typeof agentChannelBindings.$inferSelect
export type ChannelThreadConversation =
  typeof channelThreadConversations.$inferSelect
export type ChannelInstallationStatus = 'active' | 'revoked'
export type AgentChannelBindingKind = 'channel' | 'dm' | 'default'
