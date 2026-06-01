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
    status: text('status').notNull().default('connected'),
    toolSandboxManifest: text('tool_sandbox_manifest'),
    toolSandboxManifestHash: text('tool_sandbox_manifest_hash'),
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

// Snapshots are global per manifest, so every user shares the latest
// compatible sandbox image for the same tool build.
export const toolSandboxSnapshots = pgTable('tool_sandbox_snapshots', {
  manifestId: text('manifest_id').primaryKey(),
  snapshotId: text('snapshot_id').notNull(),
  manifestHash: text('manifest_hash').notNull(),
  builtAt: timestamp('built_at', { withTimezone: true }).notNull().defaultNow(),
})
export type ToolSandboxSnapshot = typeof toolSandboxSnapshots.$inferSelect

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
    // Active builds coalesce per manifest hash so concurrent attaches share one workflow.
    uniqueIndex('tool_sandbox_builds_active_unique_idx')
      .on(t.manifestId, t.manifestHash)
      .where(sql`status in ('pending', 'running')`),
  ]
)
export type ToolSandboxBuild = typeof toolSandboxBuilds.$inferSelect

// Invocation rows intentionally omit payloads and provider responses to
// avoid persisting user content in the audit trail.
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
