export interface NdjsonParseResult<T> {
  buffer: string
  skippedLines: number
  values: T[]
}

export interface NdjsonParseOptions {
  /** When true, malformed lines are skipped instead of failing the parse. */
  skipInvalidLines?: boolean
}

export function parseNdjsonChunk<T>(
  buffer: string,
  chunk: string,
  options?: NdjsonParseOptions
): NdjsonParseResult<T> {
  const lines = `${buffer}${chunk}`.split('\n')
  const nextBuffer = lines.pop() ?? ''
  const parsed = parseNdjsonLines<T>(lines, options)
  return {
    buffer: nextBuffer,
    skippedLines: parsed.skippedLines,
    values: parsed.values,
  }
}

export function flushNdjsonBuffer<T>(
  buffer: string,
  options?: NdjsonParseOptions
): NdjsonParseResult<T> {
  if (buffer.trim().length === 0) {
    return { buffer: '', skippedLines: 0, values: [] }
  }
  const parsed = parseNdjsonLines<T>([buffer], options)
  return {
    buffer: '',
    skippedLines: parsed.skippedLines,
    values: parsed.values,
  }
}

function parseNdjsonLines<T>(
  lines: readonly string[],
  options?: NdjsonParseOptions
): { skippedLines: number; values: T[] } {
  const values: T[] = []
  let skippedLines = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      continue
    }
    if (options?.skipInvalidLines) {
      try {
        values.push(JSON.parse(trimmed) as T)
      } catch {
        skippedLines += 1
      }
      continue
    }
    values.push(JSON.parse(trimmed) as T)
  }
  return { skippedLines, values }
}
