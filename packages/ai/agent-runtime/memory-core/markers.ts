export const OUTNAME_PROMOTION_MARKER_PREFIX = '<!-- outname:dreaming:promotion'

const PROMOTION_MARKER_RE =
  /<!--\s*outname:dreaming:promotion\s+key="([^"]+)"\s+source="([^"]*)"\s+at="([^"]+)"\s*-->/g

export interface PromotionMarkerInput {
  at: string
  key: string
  source: string
}

export function renderOutnamePromotionMarker(
  input: PromotionMarkerInput
): string {
  return `${OUTNAME_PROMOTION_MARKER_PREFIX} key="${escapeAttribute(input.key)}" source="${escapeAttribute(input.source)}" at="${escapeAttribute(input.at)}" -->`
}

export function extractPromotionKeys(markdown: string): Set<string> {
  const keys = new Set<string>()
  for (const match of markdown.matchAll(PROMOTION_MARKER_RE)) {
    const key = match[1]
    if (key) {
      keys.add(unescapeAttribute(key))
    }
  }
  return keys
}

export function containsPromotionMarker(
  markdown: string,
  key: string
): boolean {
  return extractPromotionKeys(markdown).has(key)
}

export function isOutnamePromotionMarkerLine(line: string): boolean {
  return line.includes(OUTNAME_PROMOTION_MARKER_PREFIX)
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
}

function unescapeAttribute(value: string): string {
  return value.replaceAll('&quot;', '"').replaceAll('&amp;', '&')
}
