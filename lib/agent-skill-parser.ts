import { parse as parseYaml } from 'yaml'
import type {
  ParsedSkillBundle,
  ParsedSkillFile,
  SkillFrontmatter,
} from './agent-skill-types'

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
const NON_SLUG_RE = /[^a-z0-9-]+/g
const REPEAT_HYPHEN_RE = /-+/g
const TRIM_HYPHEN_RE = /^-|-$/g
const WHITESPACE_RE = /\s+/g

/**
 * Mirror of bash-tool's `src/skills/frontmatter.ts`. Pure-YAML — never
 * eval JS frontmatter — and intentionally permissive about the trailing
 * newline so single-line `description: foo` documents parse cleanly.
 */
export function parseFrontmatter(raw: string): {
  data: Record<string, unknown>
  content: string
} {
  const match = raw.match(FRONTMATTER_RE)
  if (!match?.[1]) {
    return { data: {}, content: raw }
  }
  const data = (parseYaml(match[1]) as Record<string, unknown>) ?? {}
  return { data, content: match[2] ?? '' }
}

export function parseSkillFrontmatter(
  content: string
): SkillFrontmatter | null {
  try {
    const { data } = parseFrontmatter(content)
    if (
      typeof data.name !== 'string' ||
      typeof data.description !== 'string' ||
      !data.name ||
      !data.description
    ) {
      return null
    }
    return {
      name: normalizeSkillName(data.name),
      description: data.description.trim(),
    }
  } catch {
    return null
  }
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

export function normalizeSkillName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(NON_SLUG_RE, '-')
    .replace(REPEAT_HYPHEN_RE, '-')
    .replace(TRIM_HYPHEN_RE, '')
}

export function assertValidSkillName(name: string): void {
  if (!SLUG_RE.test(name)) {
    throw new Error(
      `Invalid skill name "${name}". Must match ${SLUG_RE} (lowercase, hyphens).`
    )
  }
}

/** Mirror of bash-tool's `extractBody` — frontmatter stripped, trimmed. */
export function extractSkillBody(content: string): string {
  try {
    const { content: body } = parseFrontmatter(content)
    return body.trim()
  } catch {
    return content.trim()
  }
}

export function buildSkillBundleFromMarkdown(raw: string): ParsedSkillBundle {
  const metadata = parseSkillFrontmatter(raw)
  if (!metadata) {
    throw new Error(
      'SKILL.md is missing required frontmatter. Add `name` and `description` between `---` fences at the top of the file.'
    )
  }
  assertValidSkillName(metadata.name)

  // Re-emit canonical SKILL.md with the normalized name so the on-disk
  // copy in the sandbox always agrees with the slug we stored.
  const body = extractSkillBody(raw)
  const canonical = renderSkillMd(metadata, body)
  const files: ParsedSkillFile[] = [
    { path: 'SKILL.md', content: canonical, executable: false },
  ]
  return { metadata, files }
}

export function renderSkillMd(
  metadata: SkillFrontmatter,
  body: string
): string {
  const fm = [
    '---',
    `name: ${metadata.name}`,
    // Quote-and-escape so multi-line / colon-bearing descriptions stay valid YAML.
    `description: ${yamlSingleLine(metadata.description)}`,
    '---',
  ].join('\n')
  return `${fm}\n\n${body.trim()}\n`
}

function yamlSingleLine(value: string): string {
  const compact = value.replace(WHITESPACE_RE, ' ').trim()
  return JSON.stringify(compact)
}
