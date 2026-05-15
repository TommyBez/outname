export interface NdjsonParseResult<T> {
  buffer: string
  values: T[]
}

export function parseNdjsonChunk<T>(
  buffer: string,
  chunk: string
): NdjsonParseResult<T> {
  const lines = `${buffer}${chunk}`.split('\n')
  const nextBuffer = lines.pop() ?? ''
  return {
    buffer: nextBuffer,
    values: parseNdjsonLines<T>(lines),
  }
}

export function flushNdjsonBuffer<T>(buffer: string): T[] {
  if (buffer.trim().length === 0) {
    return []
  }
  return parseNdjsonLines<T>([buffer])
}

function parseNdjsonLines<T>(lines: readonly string[]): T[] {
  const values: T[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length > 0) {
      values.push(JSON.parse(trimmed) as T)
    }
  }
  return values
}
