import { eq, inArray, sql } from 'drizzle-orm'
import { normalizeCandidateText, scoreRecallCandidate } from '../rank'
import type {
  DreamingConfig,
  DreamingDeepSummary,
  DreamingPhase,
  DreamingPhaseSummary,
  DreamingStore,
  EvidenceSnippet,
  RecallCandidate,
} from '../types'
import {
  evidenceSnippets,
  phaseSignals,
  promotions,
  recallCandidates,
  sweeps,
} from './schema'

export function beginSweep(input: {
  agentId: string
  attempt: number
  eventId: string
  localDate: string
  nowIso: string
  store: DreamingStore
  sweepId: string
}): void {
  input.store.db
    .insert(sweeps)
    .values({
      agentId: input.agentId,
      attempt: input.attempt,
      completedAt: null,
      error: null,
      eventId: input.eventId,
      id: input.sweepId,
      localDate: input.localDate,
      startedAt: input.nowIso,
      status: 'running',
    })
    .onConflictDoUpdate({
      target: sweeps.id,
      set: {
        attempt: input.attempt,
        error: null,
        status: 'running',
      },
    })
    .run()
}

export function completeSweep(input: {
  completedAt: string
  store: DreamingStore
  sweepId: string
}): void {
  input.store.db
    .update(sweeps)
    .set({
      completedAt: input.completedAt,
      error: null,
      status: 'completed',
    })
    .where(eq(sweeps.id, input.sweepId))
    .run()
}

export function failSweep(input: {
  error: string
  failedAt: string
  store: DreamingStore
  sweepId: string
}): void {
  input.store.db
    .update(sweeps)
    .set({
      completedAt: input.failedAt,
      error: input.error,
      status: 'failed',
    })
    .where(eq(sweeps.id, input.sweepId))
    .run()
}

export function upsertEvidenceSnippets(input: {
  config: DreamingConfig
  now: Date
  snippets: EvidenceSnippet[]
  store: DreamingStore
}): DreamingPhaseSummary {
  const candidateKeys = new Set<string>()
  for (const snippet of input.snippets) {
    candidateKeys.add(snippet.candidateKey)
    input.store.db
      .insert(evidenceSnippets)
      .values(snippet)
      .onConflictDoNothing()
      .run()
  }

  for (const candidateKey of candidateKeys) {
    upsertRecallCandidateFromEvidence({
      candidateKey,
      config: input.config,
      now: input.now,
      store: input.store,
    })
  }

  return {
    candidatesConsidered: candidateKeys.size,
    evidenceSnippets: input.snippets.length,
    phase: 'light',
    signalsWritten: 0,
  }
}

export function writePhaseSignal(input: {
  candidateKey?: string | null
  metadata: Record<string, unknown>
  phase: DreamingPhase
  score?: number | null
  signalType: string
  store: DreamingStore
  sweepId: string
  timestamp: string
}): void {
  input.store.db
    .insert(phaseSignals)
    .values({
      candidateKey: input.candidateKey ?? null,
      createdAt: input.timestamp,
      id: `${input.sweepId}:${input.phase}:${input.signalType}:${input.candidateKey ?? 'global'}`,
      metadataJson: JSON.stringify(input.metadata),
      phase: input.phase,
      score: input.score ?? null,
      signalType: input.signalType,
      sweepId: input.sweepId,
    })
    .onConflictDoUpdate({
      target: phaseSignals.id,
      set: {
        metadataJson: JSON.stringify(input.metadata),
        score: input.score ?? null,
      },
    })
    .run()
}

export function runRemPhase(input: {
  config: DreamingConfig
  now: Date
  nowIso: string
  store: DreamingStore
  sweepId: string
}): DreamingPhaseSummary {
  const candidates = listActiveCandidates(input.store)
  for (const candidate of candidates) {
    const score = scoreRecallCandidate({
      candidate,
      config: input.config,
      now: input.now,
    })
    input.store.db
      .update(recallCandidates)
      .set({ score })
      .where(eq(recallCandidates.key, candidate.key))
      .run()
    writePhaseSignal({
      candidateKey: candidate.key,
      metadata: {
        recallCount: candidate.recallCount,
        uniqueQueryCount: candidate.uniqueQueryCount,
      },
      phase: 'rem',
      score,
      signalType: 'score',
      store: input.store,
      sweepId: input.sweepId,
      timestamp: input.nowIso,
    })
  }
  return {
    candidatesConsidered: candidates.length,
    evidenceSnippets: 0,
    phase: 'rem',
    signalsWritten: candidates.length,
  }
}

export function listActiveCandidates(store: DreamingStore): RecallCandidate[] {
  return store.db
    .select()
    .from(recallCandidates)
    .where(eq(recallCandidates.status, 'active'))
    .all()
}

export function listEvidenceForCandidates(input: {
  candidateKeys: string[]
  store: DreamingStore
}): Map<string, EvidenceSnippet[]> {
  if (input.candidateKeys.length === 0) {
    return new Map()
  }
  const rows = input.store.db
    .select()
    .from(evidenceSnippets)
    .where(inArray(evidenceSnippets.candidateKey, input.candidateKeys))
    .all()
  const byCandidate = new Map<string, EvidenceSnippet[]>()
  for (const row of rows) {
    const existing = byCandidate.get(row.candidateKey) ?? []
    existing.push(row)
    byCandidate.set(row.candidateKey, existing)
  }
  for (const snippets of byCandidate.values()) {
    snippets.sort((left, right) =>
      right.observedAt.localeCompare(left.observedAt)
    )
  }
  return byCandidate
}

export function recordDeepPromotions(input: {
  promotionsWritten: Array<{ key: string; marker: string; text: string }>
  store: DreamingStore
  sweepId: string
  timestamp: string
}): DreamingDeepSummary {
  for (const promotion of input.promotionsWritten) {
    input.store.db
      .insert(promotions)
      .values({
        key: promotion.key,
        marker: promotion.marker,
        memoryPath: 'MEMORY.md',
        promotedAt: input.timestamp,
        sweepId: input.sweepId,
      })
      .onConflictDoNothing()
      .run()
    input.store.db
      .update(recallCandidates)
      .set({ status: 'promoted' })
      .where(eq(recallCandidates.key, promotion.key))
      .run()
  }

  writePhaseSignal({
    metadata: { promotions: input.promotionsWritten.length },
    phase: 'deep',
    signalType: 'promotion_summary',
    store: input.store,
    sweepId: input.sweepId,
    timestamp: input.timestamp,
  })

  return {
    candidatesConsidered: input.promotionsWritten.length,
    evidenceSnippets: 0,
    phase: 'deep',
    promotions: input.promotionsWritten,
    signalsWritten: 1,
  }
}

function upsertRecallCandidateFromEvidence(input: {
  candidateKey: string
  config: DreamingConfig
  now: Date
  store: DreamingStore
}): void {
  const counts = input.store.db.get<{
    firstSeenAt: string
    lastSeenAt: string
    normalizedText: string
    recallCount: number
    uniqueQueryCount: number
  }>(sql`
    SELECT
      min(observed_at) as firstSeenAt,
      max(observed_at) as lastSeenAt,
      min(text) as normalizedText,
      count(*) as recallCount,
      count(distinct query_key) as uniqueQueryCount
    FROM evidence_snippets
    WHERE candidate_key = ${input.candidateKey}
  `)
  if (!counts) {
    return
  }
  const candidate = {
    firstSeenAt: counts.firstSeenAt,
    key: input.candidateKey,
    lastSeenAt: counts.lastSeenAt,
    normalizedText: normalizeCandidateText(counts.normalizedText),
    recallCount: Number(counts.recallCount),
    score: 0,
    status: 'active' as const,
    uniqueQueryCount: Number(counts.uniqueQueryCount),
  }
  const score = scoreRecallCandidate({
    candidate,
    config: input.config,
    now: input.now,
  })
  input.store.db
    .insert(recallCandidates)
    .values({ ...candidate, score })
    .onConflictDoUpdate({
      target: recallCandidates.key,
      set: {
        firstSeenAt: candidate.firstSeenAt,
        lastSeenAt: candidate.lastSeenAt,
        normalizedText: candidate.normalizedText,
        recallCount: candidate.recallCount,
        score,
        uniqueQueryCount: candidate.uniqueQueryCount,
      },
    })
    .run()
}
