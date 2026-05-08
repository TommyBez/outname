import {
  type AgentEditMarkdownFiles,
  type AgentEditSettings,
  type DiffLine,
  MARKDOWN_FILE_FIELDS,
  type MarkdownChange,
  type MarkdownFileKey,
  type RawDiffLine,
  SETTINGS_FIELDS,
  type SettingsChange,
  type SettingsKey,
} from './types'

export function getMarkdownChanges(
  input: unknown,
  currentMarkdownFiles: AgentEditMarkdownFiles
): MarkdownChange[] {
  if (!isRecord(input)) {
    return []
  }

  const changes: MarkdownChange[] = []
  for (const field of MARKDOWN_FILE_FIELDS) {
    const proposed = readStringField(input, field.key)
    if (proposed === null) {
      continue
    }
    const current = currentMarkdownFiles[field.key]
    if (normalizeMarkdown(current) === normalizeMarkdown(proposed)) {
      continue
    }
    const diffStats = countChangedLines(current, proposed)
    changes.push({
      addedLineCount: diffStats.addedLineCount,
      current,
      path: field.path,
      proposed,
      removedLineCount: diffStats.removedLineCount,
      title: field.title,
    })
  }
  return changes
}

export function getSettingsChanges(
  input: unknown,
  currentSettings: AgentEditSettings
): SettingsChange[] {
  if (!isRecord(input)) {
    return []
  }

  const changes: SettingsChange[] = []
  for (const field of SETTINGS_FIELDS) {
    const proposed = input[field.key]
    if (proposed === undefined) {
      continue
    }
    const current = currentSettings[field.key]
    if (
      normalizeComparableValue(current) === normalizeComparableValue(proposed)
    ) {
      continue
    }
    changes.push({
      current: formatSettingValue(field.key, current),
      label: field.label,
      proposed: formatSettingValue(field.key, proposed),
    })
  }
  return changes
}

export function buildCompactLineDiff(
  current: string,
  proposed: string
): DiffLine[] {
  const currentLines = splitMarkdownLines(current)
  const proposedLines = splitMarkdownLines(proposed)
  const bounds = getChangedBounds(currentLines, proposedLines)
  const lines: RawDiffLine[] = []
  const contextStart = Math.max(0, bounds.start - 2)

  if (contextStart > 0) {
    lines.push({ kind: 'omitted', text: '', count: contextStart })
  }
  appendLines(lines, currentLines.slice(contextStart, bounds.start), 'context')
  appendLimitedLines(
    lines,
    currentLines.slice(bounds.start, bounds.currentEnd + 1),
    'removed'
  )
  appendLimitedLines(
    lines,
    proposedLines.slice(bounds.start, bounds.proposedEnd + 1),
    'added'
  )

  const suffixStart = bounds.proposedEnd + 1
  const suffixEnd = Math.min(proposedLines.length, suffixStart + 2)
  appendLines(lines, proposedLines.slice(suffixStart, suffixEnd), 'context')
  if (suffixEnd < proposedLines.length) {
    lines.push({
      kind: 'omitted',
      text: '',
      count: proposedLines.length - suffixEnd,
    })
  }
  const diffLines =
    lines.length > 0
      ? lines
      : ([{ kind: 'context', text: 'No line changes' }] satisfies RawDiffLine[])
  return withStableDiffLineIds(diffLines)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStringField(
  input: Record<string, unknown>,
  key: MarkdownFileKey
): string | null {
  const value = input[key]
  return typeof value === 'string' ? value : null
}

function normalizeComparableValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
}

function formatSettingValue(key: SettingsKey, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'none'
  }
  if (key === 'heartbeatEnabled' || key === 'reflectionEnabled') {
    return value === true ? 'on' : 'off'
  }
  if (
    key === 'heartbeatIntervalMinutes' ||
    key === 'reflectionIntervalMinutes'
  ) {
    return `${value} min`
  }
  return String(value)
}

function normalizeMarkdown(value: string): string {
  return value.replace(/\r\n?/g, '\n')
}

function splitMarkdownLines(value: string): string[] {
  const normalized = normalizeMarkdown(value)
  return normalized.length === 0 ? [] : normalized.split('\n')
}

function countChangedLines(
  current: string,
  proposed: string
): {
  addedLineCount: number
  removedLineCount: number
} {
  const currentLines = splitMarkdownLines(current)
  const proposedLines = splitMarkdownLines(proposed)
  const bounds = getChangedBounds(currentLines, proposedLines)
  return {
    addedLineCount: Math.max(0, bounds.proposedEnd - bounds.start + 1),
    removedLineCount: Math.max(0, bounds.currentEnd - bounds.start + 1),
  }
}

function getChangedBounds(currentLines: string[], proposedLines: string[]) {
  let start = 0
  while (
    start < currentLines.length &&
    start < proposedLines.length &&
    currentLines[start] === proposedLines[start]
  ) {
    start += 1
  }

  let currentEnd = currentLines.length - 1
  let proposedEnd = proposedLines.length - 1
  while (
    currentEnd >= start &&
    proposedEnd >= start &&
    currentLines[currentEnd] === proposedLines[proposedEnd]
  ) {
    currentEnd -= 1
    proposedEnd -= 1
  }

  return { currentEnd, proposedEnd, start }
}

function appendLines(
  target: RawDiffLine[],
  source: string[],
  kind: RawDiffLine['kind']
): void {
  for (const line of source) {
    target.push({ kind, text: line })
  }
}

function appendLimitedLines(
  target: RawDiffLine[],
  source: string[],
  kind: RawDiffLine['kind']
): void {
  const visibleLines = source.slice(0, 12)
  appendLines(target, visibleLines, kind)
  if (visibleLines.length < source.length) {
    target.push({
      kind: 'omitted',
      text: '',
      count: source.length - visibleLines.length,
    })
  }
}

function withStableDiffLineIds(lines: RawDiffLine[]): DiffLine[] {
  const seenIds = new Map<string, number>()
  return lines.map((line) => {
    const baseId = `${line.kind}:${line.count ?? ''}:${line.text}`
    const occurrence = seenIds.get(baseId) ?? 0
    seenIds.set(baseId, occurrence + 1)
    return {
      ...line,
      id: `${baseId}:${occurrence}`,
    }
  })
}
