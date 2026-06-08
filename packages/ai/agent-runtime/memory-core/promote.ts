import { extractPromotionKeys, renderOutnamePromotionMarker } from './markers'
import { isPromotionEligible } from './rank'
import type {
  DreamingConfig,
  EvidenceSnippet,
  PromotionCandidate,
  RecallCandidate,
} from './types'

const TOKEN_RE = /\S+/g

export function selectPromotionCandidates(input: {
  candidates: RecallCandidate[]
  config: DreamingConfig
  evidenceByCandidate: Map<string, EvidenceSnippet[]>
  existingMemory: string
  now: Date
}): PromotionCandidate[] {
  const existingKeys = extractPromotionKeys(input.existingMemory)
  return input.candidates
    .filter((candidate) => !existingKeys.has(candidate.key))
    .filter((candidate) =>
      isPromotionEligible({
        candidate,
        config: input.config,
        now: input.now,
      })
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      if (right.recallCount !== left.recallCount) {
        return right.recallCount - left.recallCount
      }
      return left.key.localeCompare(right.key)
    })
    .slice(0, input.config.maxPromotionsPerSweep)
    .map((candidate) => ({
      candidate,
      evidence: input.evidenceByCandidate.get(candidate.key)?.[0] ?? null,
      reason: 'stable repeated evidence',
    }))
}

export function renderMemoryPromotion(input: {
  at: string
  config: DreamingConfig
  promotion: PromotionCandidate
}): { marker: string; text: string } {
  const source = input.promotion.evidence
    ? sourceLabel(input.promotion.evidence)
    : 'dreaming-store'
  const marker = renderOutnamePromotionMarker({
    at: input.at,
    key: input.promotion.candidate.key,
    source,
  })
  const text = truncateTokens(
    input.promotion.evidence?.text ?? input.promotion.candidate.normalizedText,
    input.config.maxPromotedSnippetTokens
  )
  return {
    marker,
    text: `- ${text} ${marker}`,
  }
}

export function appendPromotionsToMemory(input: {
  existingMemory: string
  lines: string[]
}): string {
  if (input.lines.length === 0) {
    return input.existingMemory
  }
  const prefix = input.existingMemory.trimEnd()
  const section = ['## Dreaming Promotions', '', ...input.lines].join('\n')
  return prefix ? `${prefix}\n\n${section}\n` : `${section}\n`
}

function sourceLabel(evidence: EvidenceSnippet): string {
  if (evidence.path && evidence.line) {
    return `${evidence.path}:${evidence.line}`
  }
  return evidence.sourceId
}

function truncateTokens(text: string, maxTokens: number): string {
  const tokens = text.match(TOKEN_RE) ?? []
  if (tokens.length <= maxTokens) {
    return text.trim()
  }
  return `${tokens.slice(0, maxTokens).join(' ')}...`
}
