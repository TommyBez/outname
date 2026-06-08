import { candidateKeyForText, normalizeCandidateText } from './rank'
import { stripManagedDreamingContent } from './sanitize'
import type { EvidenceSnippet, EvidenceSourceType } from './types'

const MIN_SIGNAL_CHARS = 24
const MAX_SIGNAL_CHARS = 500
const LOW_SIGNAL_RE =
  /^(?:run started|heartbeat complete|dreaming complete|completed|ok|done)$/i

export interface ExtractEvidenceInput {
  maxSnippets?: number
  observedAt: string
  path?: string | null
  sourceId: string
  sourceType: EvidenceSourceType
  text: string
}

export function extractEvidenceSnippets(
  input: ExtractEvidenceInput
): EvidenceSnippet[] {
  const cleaned = stripManagedDreamingContent(input.text)
  const snippets: EvidenceSnippet[] = []
  const lines = cleaned.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const rawText = lines[index]?.trim() ?? ''
    const normalized = normalizeCandidateText(rawText)
    if (!isUsefulSignal(normalized)) {
      continue
    }
    const candidateKey = candidateKeyForText(normalized)
    const sourceLine = index + 1
    snippets.push({
      candidateKey,
      id: `${input.sourceType}:${input.sourceId}:${sourceLine}:${candidateKey}`,
      line: input.path ? sourceLine : null,
      observedAt: input.observedAt,
      path: input.path ?? null,
      queryKey: queryKeyForSnippet({
        path: input.path,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
      }),
      sourceId: input.sourceId,
      sourceType: input.sourceType,
      text: rawText.slice(0, MAX_SIGNAL_CHARS),
    })
    if (input.maxSnippets && snippets.length >= input.maxSnippets) {
      break
    }
  }
  return snippets
}

function isUsefulSignal(text: string): boolean {
  return (
    text.length >= MIN_SIGNAL_CHARS &&
    text.length <= MAX_SIGNAL_CHARS &&
    !LOW_SIGNAL_RE.test(text) &&
    !text.startsWith('#')
  )
}

function queryKeyForSnippet(input: {
  path?: string | null
  sourceId: string
  sourceType: EvidenceSourceType
}): string {
  return input.path
    ? `${input.sourceType}:${input.path}`
    : `${input.sourceType}:${input.sourceId}`
}
