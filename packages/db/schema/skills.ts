import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { agent } from './agents'

export type AgentSkillSourceType = 'github' | 'skill_md' | 'skills_sh' | 'zip'

export const agentSkills = pgTable(
  'agent_skills',
  {
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').notNull(),
    description: text('description').notNull(),
    sourceType: text('source_type').$type<AgentSkillSourceType>().notNull(),
    sourceUrl: text('source_url'),
    sourceRef: text('source_ref'),
    sourcePath: text('source_path'),
    contentHash: text('content_hash').notNull(),
    fileCount: integer('file_count').notNull(),
    totalBytes: integer('total_bytes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.agentId, t.slug] }),
    uniqueIndex('agent_skills_agent_name_unique_idx').on(
      t.agentId,
      t.nameNormalized
    ),
    index('agent_skills_agent_idx').on(t.agentId),
  ]
)

export type AgentSkill = typeof agentSkills.$inferSelect
