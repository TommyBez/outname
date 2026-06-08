import { describe, expect, it } from 'vitest'
import { DEFAULT_DREAMING_CONFIG } from './config'
import { renderOutnamePromotionMarker } from './markers'
import {
  appendPromotionsToMemory,
  renderMemoryPromotion,
  selectPromotionCandidates,
} from './promote'
import type { EvidenceSnippet, RecallCandidate } from './types'

describe('dreaming promotion selection', () => {
  const candidate: RecallCandidate = {
    firstSeenAt: '2026-06-01T00:00:00.000Z',
    key: 'mem_abc',
    lastSeenAt: '2026-06-08T00:00:00.000Z',
    normalizedText: 'tommaso prefers implementation plans before coding',
    recallCount: 4,
    score: 0.91,
    status: 'active',
    uniqueQueryCount: 3,
  }

  const evidence: EvidenceSnippet = {
    candidateKey: candidate.key,
    id: 'evidence_1',
    line: 12,
    observedAt: '2026-06-08T00:00:00.000Z',
    path: 'logs/2026-06-08.md',
    queryKey: 'log:2026-06-08',
    sourceId: 'logs/2026-06-08.md',
    sourceType: 'log',
    text: 'Tommaso prefers implementation plans before coding.',
  }

  it('selects eligible candidates and skips existing markers', () => {
    const evidenceByCandidate = new Map([[candidate.key, [evidence]]])

    expect(
      selectPromotionCandidates({
        candidates: [candidate],
        config: DEFAULT_DREAMING_CONFIG,
        evidenceByCandidate,
        existingMemory: '',
        now: new Date('2026-06-08T12:00:00.000Z'),
      })
    ).toHaveLength(1)

    const marker = renderOutnamePromotionMarker({
      at: '2026-06-08T12:00:00.000Z',
      key: candidate.key,
      source: 'logs/2026-06-08.md:12',
    })
    expect(
      selectPromotionCandidates({
        candidates: [candidate],
        config: DEFAULT_DREAMING_CONFIG,
        evidenceByCandidate,
        existingMemory: marker,
        now: new Date('2026-06-08T12:00:00.000Z'),
      })
    ).toHaveLength(0)
  })

  it('renders append-only MEMORY.md promotions with marker', () => {
    const rendered = renderMemoryPromotion({
      at: '2026-06-08T12:00:00.000Z',
      config: DEFAULT_DREAMING_CONFIG,
      promotion: {
        candidate,
        evidence,
        reason: 'stable repeated evidence',
      },
    })

    expect(rendered.text).toContain('Tommaso prefers implementation plans')
    expect(rendered.marker).toContain('outname:dreaming:promotion')
    expect(
      appendPromotionsToMemory({
        existingMemory: '# Memory\n',
        lines: [rendered.text],
      })
    ).toContain('## Dreaming Promotions')
  })
})
