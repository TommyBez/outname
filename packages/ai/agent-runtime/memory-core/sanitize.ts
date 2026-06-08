import { isOutnamePromotionMarkerLine } from './markers'

const DREAMING_MANAGED_BLOCK_RE =
  /<!--\s*outname:dreaming:[\w-]+:start\b[\s\S]*?<!--\s*outname:dreaming:[\w-]+:end\s*-->/g

export function stripManagedDreamingContent(markdown: string): string {
  return markdown
    .replace(DREAMING_MANAGED_BLOCK_RE, '')
    .split('\n')
    .filter((line) => !isOutnamePromotionMarkerLine(line))
    .join('\n')
}
