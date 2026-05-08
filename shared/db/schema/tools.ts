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
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { agent } from './agents'
import { user } from './auth'

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

export type AgentTool = typeof agentTools.$inferSelect
export type AgentToolStatus = 'connected' | 'pending'
export type AgentToolKind = 'maintainer' | 'sub_agent'
