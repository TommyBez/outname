const MAX_SKILL_SLUG_LENGTH = 80
const INVALID_SLUG_CHARS_PATTERN = /[^a-z0-9-]+/g
const REPEATED_DASHES_PATTERN = /-+/g
const EDGE_DASHES_PATTERN = /^-+|-+$/g

export function slugFromSkillName(name: string): string {
  return sanitizeSkillSlug(name)
}

export function sanitizeSkillSlug(value: string): string {
  const slug = value
    .trim()
    .toLocaleLowerCase()
    .replace(INVALID_SLUG_CHARS_PATTERN, '-')
    .replace(REPEATED_DASHES_PATTERN, '-')
    .replace(EDGE_DASHES_PATTERN, '')
    .slice(0, MAX_SKILL_SLUG_LENGTH)
    .replace(EDGE_DASHES_PATTERN, '')

  return slug || 'skill'
}

export function uniqueSkillSlug(input: {
  baseSlug: string
  contentHash: string
  usedSlugs: ReadonlySet<string>
}): string {
  const base = sanitizeSkillSlug(input.baseSlug)
  if (!input.usedSlugs.has(base)) {
    return base
  }

  for (const length of [8, 12, 16]) {
    const suffix = input.contentHash.slice(0, length)
    const prefix = base
      .slice(0, MAX_SKILL_SLUG_LENGTH - suffix.length - 1)
      .replace(EDGE_DASHES_PATTERN, '')
    const candidate = `${prefix || 'skill'}-${suffix}`
    if (!input.usedSlugs.has(candidate)) {
      return candidate
    }
  }

  throw new Error(`Could not generate a unique slug for ${base}.`)
}
