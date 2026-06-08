import type { DreamingConfig } from './types'

export const DEFAULT_DREAMING_CONFIG: DreamingConfig = {
  diaryNarrativeEnabled: true,
  lookbackDays: 7,
  maxPromotedSnippetTokens: 160,
  maxPromotionsPerSweep: 10,
  maxTranscriptBytesPerEvent: 16_384,
  maxTranscriptBytesPerSweep: 64_000,
  maxTranscriptEventsPerSweep: 20,
  maxTranscriptMessagesPerEvent: 40,
  maxTranscriptSnippetsPerEvent: 8,
  narrativeMaxOutputTokens: 500,
  promotionMaxAgeDays: 30,
  promotionMinRecallCount: 3,
  promotionMinScore: 0.8,
  promotionMinUniqueQueries: 3,
  promotionRecencyHalfLifeDays: 14,
} as const

export function resolveDreamingConfig(
  overrides: Partial<DreamingConfig> = {}
): DreamingConfig {
  return {
    ...DEFAULT_DREAMING_CONFIG,
    ...overrides,
  }
}
