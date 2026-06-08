import type { SQLJsDatabase } from 'drizzle-orm/sql-js'
import type { dreamingSchema } from './store/schema'

export type DreamingPhase = 'light' | 'rem' | 'deep' | 'diary'

export type DreamingSweepStatus = 'running' | 'completed' | 'failed'

export type EvidenceSourceType = 'event_transcript' | 'log'

export type RecallCandidateStatus = 'active' | 'promoted' | 'rejected'

export interface DreamingConfig {
  diaryNarrativeEnabled: boolean
  lookbackDays: number
  maxPromotedSnippetTokens: number
  maxPromotionsPerSweep: number
  maxTranscriptBytesPerEvent: number
  maxTranscriptBytesPerSweep: number
  maxTranscriptEventsPerSweep: number
  maxTranscriptMessagesPerEvent: number
  maxTranscriptSnippetsPerEvent: number
  narrativeMaxOutputTokens: number
  promotionMaxAgeDays: number
  promotionMinRecallCount: number
  promotionMinScore: number
  promotionMinUniqueQueries: number
  promotionRecencyHalfLifeDays: number
}

export interface DreamingSweep {
  agentId: string
  attempt: number
  completedAt: string | null
  error: string | null
  eventId: string
  id: string
  localDate: string
  startedAt: string
  status: DreamingSweepStatus
}

export interface EvidenceSnippet {
  candidateKey: string
  id: string
  line: number | null
  observedAt: string
  path: string | null
  queryKey: string
  sourceId: string
  sourceType: EvidenceSourceType
  text: string
}

export interface RecallCandidate {
  firstSeenAt: string
  key: string
  lastSeenAt: string
  normalizedText: string
  recallCount: number
  score: number
  status: RecallCandidateStatus
  uniqueQueryCount: number
}

export interface PhaseSignal {
  candidateKey: string | null
  createdAt: string
  id: string
  metadataJson: string
  phase: DreamingPhase
  score: number | null
  signalType: string
  sweepId: string
}

export interface PromotionCandidate {
  candidate: RecallCandidate
  evidence: EvidenceSnippet | null
  reason: string
}

export interface DreamingStore {
  db: SQLJsDatabase<typeof dreamingSchema>
  export(): Uint8Array
  save(): Promise<void>
}

export interface DreamingPhaseSummary {
  candidatesConsidered: number
  evidenceSnippets: number
  phase: DreamingPhase
  signalsWritten: number
}

export interface DreamingDeepSummary extends DreamingPhaseSummary {
  promotions: Array<{
    key: string
    marker: string
    text: string
  }>
}

export interface DreamingRunSummary {
  deep: DreamingDeepSummary
  light: DreamingPhaseSummary
  rem: DreamingPhaseSummary
  sweepId: string
}
