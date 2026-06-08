import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'
import type {
  DreamingPhase,
  DreamingSweepStatus,
  EvidenceSourceType,
  RecallCandidateStatus,
} from '../types'

export const schemaMeta = sqliteTable('schema_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const sweeps = sqliteTable(
  'sweeps',
  {
    agentId: text('agent_id').notNull(),
    attempt: integer('attempt').notNull(),
    completedAt: text('completed_at'),
    error: text('error'),
    eventId: text('event_id').notNull(),
    id: text('id').primaryKey(),
    localDate: text('local_date').notNull(),
    startedAt: text('started_at').notNull(),
    status: text('status').$type<DreamingSweepStatus>().notNull(),
  },
  (t) => [
    index('sweeps_agent_date_idx').on(t.agentId, t.localDate),
    index('sweeps_event_idx').on(t.eventId),
  ]
)

export const ingestionCheckpoints = sqliteTable('ingestion_checkpoints', {
  cursor: text('cursor').notNull(),
  observedAt: text('observed_at').notNull(),
  source: text('source').primaryKey(),
})

export const recallCandidates = sqliteTable(
  'recall_candidates',
  {
    firstSeenAt: text('first_seen_at').notNull(),
    key: text('key').primaryKey(),
    lastSeenAt: text('last_seen_at').notNull(),
    normalizedText: text('normalized_text').notNull(),
    recallCount: integer('recall_count').notNull(),
    score: real('score').notNull(),
    status: text('status').$type<RecallCandidateStatus>().notNull(),
    uniqueQueryCount: integer('unique_query_count').notNull(),
  },
  (t) => [
    index('recall_candidates_score_idx').on(t.status, t.score),
    index('recall_candidates_last_seen_idx').on(t.lastSeenAt),
  ]
)

export const evidenceSnippets = sqliteTable(
  'evidence_snippets',
  {
    candidateKey: text('candidate_key').notNull(),
    id: text('id').primaryKey(),
    line: integer('line'),
    observedAt: text('observed_at').notNull(),
    path: text('path'),
    queryKey: text('query_key').notNull(),
    sourceId: text('source_id').notNull(),
    sourceType: text('source_type').$type<EvidenceSourceType>().notNull(),
    text: text('text').notNull(),
  },
  (t) => [
    index('evidence_candidate_idx').on(t.candidateKey),
    index('evidence_source_idx').on(t.sourceType, t.sourceId),
  ]
)

export const phaseSignals = sqliteTable(
  'phase_signals',
  {
    candidateKey: text('candidate_key'),
    createdAt: text('created_at').notNull(),
    id: text('id').primaryKey(),
    metadataJson: text('metadata_json').notNull(),
    phase: text('phase').$type<DreamingPhase>().notNull(),
    score: real('score'),
    signalType: text('signal_type').notNull(),
    sweepId: text('sweep_id').notNull(),
  },
  (t) => [
    index('phase_signals_sweep_idx').on(t.sweepId, t.phase),
    index('phase_signals_candidate_idx').on(t.candidateKey),
  ]
)

export const promotions = sqliteTable(
  'promotions',
  {
    key: text('key').primaryKey(),
    marker: text('marker').notNull(),
    memoryPath: text('memory_path').notNull(),
    promotedAt: text('promoted_at').notNull(),
    sweepId: text('sweep_id').notNull(),
  },
  (t) => [index('promotions_sweep_idx').on(t.sweepId)]
)

export const dreamingSchema = {
  evidenceSnippets,
  ingestionCheckpoints,
  phaseSignals,
  promotions,
  recallCandidates,
  schemaMeta,
  sweeps,
}
