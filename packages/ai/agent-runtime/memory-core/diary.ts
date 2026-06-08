import type { DreamingRunSummary } from './types'

export function renderDeterministicDiarySection(input: {
  completedAt: string
  localDate: string
  summary: DreamingRunSummary
}): string {
  const lines = [
    `## ${input.localDate}`,
    '',
    `Completed at: ${input.completedAt}`,
    `Sweep: ${input.summary.sweepId}`,
    '',
    `- Light: ${input.summary.light.evidenceSnippets} evidence snippets, ${input.summary.light.candidatesConsidered} candidates considered.`,
    `- REM: ${input.summary.rem.signalsWritten} phase signals written.`,
    `- Deep: ${input.summary.deep.promotions.length} promotions written.`,
  ]

  if (input.summary.deep.promotions.length > 0) {
    lines.push('', '### Promotions')
    for (const promotion of input.summary.deep.promotions) {
      lines.push(`- ${promotion.key}: ${promotion.text}`)
    }
  }

  return `${lines.join('\n')}\n`
}

export function appendDiarySection(input: {
  existingDreams: string
  section: string
}): string {
  const prefix = input.existingDreams.trimEnd()
  return prefix ? `${prefix}\n\n${input.section}` : input.section
}

export function appendNarrativeToDiarySection(input: {
  narrative: string
  section: string
}): string {
  const narrative = input.narrative.trim()
  if (!narrative) {
    return input.section
  }
  return `${input.section.trimEnd()}\n\n### Narrative\n${narrative}\n`
}
