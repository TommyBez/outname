import { createHash } from 'node:crypto'
import type { DreamingConfig, RecallCandidate } from './types'

const WHITESPACE_RE = /\s+/g
const MARKDOWN_PREFIX_RE = /^[-*+]\s+(?:\[[ xX]\]\s+)?/

export function normalizeCandidateText(text: string): string {
  return text
    .replace(MARKDOWN_PREFIX_RE, '')
    .replace(WHITESPACE_RE, ' ')
    .trim()
    .toLowerCase()
}

export function candidateKeyForText(text: string): string {
  const normalized = normalizeCandidateText(text)
  return `mem_${createHash('sha256').update(normalized).digest('hex').slice(0, 20)}`
}

export function scoreRecallCandidate(input: {
  candidate: Pick<
    RecallCandidate,
    'lastSeenAt' | 'recallCount' | 'uniqueQueryCount'
  >
  config: DreamingConfig
  now: Date
}): number {
  const ageMs = Math.max(
    0,
    input.now.getTime() - new Date(input.candidate.lastSeenAt).getTime()
  )
  const ageDays = ageMs / 86_400_000
  const recency = 0.5 ** (ageDays / input.config.promotionRecencyHalfLifeDays)
  const recall = Math.min(
    1,
    input.candidate.recallCount / input.config.promotionMinRecallCount
  )
  const diversity = Math.min(
    1,
    input.candidate.uniqueQueryCount / input.config.promotionMinUniqueQueries
  )
  return roundScore(0.45 * recall + 0.35 * diversity + 0.2 * recency)
}

export function isPromotionEligible(input: {
  candidate: RecallCandidate
  config: DreamingConfig
  now: Date
}): boolean {
  const firstSeenAgeMs = Math.max(
    0,
    input.now.getTime() - new Date(input.candidate.firstSeenAt).getTime()
  )
  const firstSeenAgeDays = firstSeenAgeMs / 86_400_000
  return (
    input.candidate.status === 'active' &&
    input.candidate.score >= input.config.promotionMinScore &&
    input.candidate.recallCount >= input.config.promotionMinRecallCount &&
    input.candidate.uniqueQueryCount >=
      input.config.promotionMinUniqueQueries &&
    firstSeenAgeDays <= input.config.promotionMaxAgeDays
  )
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000
}
