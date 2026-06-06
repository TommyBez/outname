import { parse as parseYaml } from 'yaml'

const FRONTMATTER_DELIMITER = '---'
const LEADING_NEWLINE_PATTERN = /^\n/

export interface ParsedSkillMd {
  description: string
  instructions: string
  name: string
  nameNormalized: string
}

export class SkillMdError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillMdError'
  }
}

export function normalizeSkillName(name: string): string {
  return name.trim().normalize('NFC').toLowerCase()
}

export function parseSkillMd(content: string): ParsedSkillMd {
  const normalized = content.replace(/\r\n?/g, '\n')
  if (!normalized.startsWith(`${FRONTMATTER_DELIMITER}\n`)) {
    throw new SkillMdError('SKILL.md must start with YAML frontmatter.')
  }

  const closingDelimiterIndex = findClosingFrontmatterDelimiter(normalized)
  if (closingDelimiterIndex === -1) {
    throw new SkillMdError('SKILL.md frontmatter is missing a closing ---.')
  }

  const frontmatter = normalized.slice(
    FRONTMATTER_DELIMITER.length + 1,
    closingDelimiterIndex
  )
  const bodyStart = closingDelimiterIndex + FRONTMATTER_DELIMITER.length
  const rawBody = normalized
    .slice(bodyStart)
    .replace(LEADING_NEWLINE_PATTERN, '')
  const data = parseSkillFrontmatter(frontmatter)

  return {
    description: data.description,
    instructions: rawBody,
    name: data.name,
    nameNormalized: normalizeSkillName(data.name),
  }
}

function findClosingFrontmatterDelimiter(content: string): number {
  const pattern = `\n${FRONTMATTER_DELIMITER}\n`
  const index = content.indexOf(pattern, FRONTMATTER_DELIMITER.length + 1)
  if (index !== -1) {
    return index + 1
  }
  const trailingPattern = `\n${FRONTMATTER_DELIMITER}`
  if (content.endsWith(trailingPattern)) {
    return content.length - FRONTMATTER_DELIMITER.length
  }
  return -1
}

function parseSkillFrontmatter(content: string): {
  description: string
  name: string
} {
  let parsed: unknown
  try {
    parsed = parseYaml(content)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new SkillMdError(`SKILL.md frontmatter is invalid YAML: ${message}`)
  }

  if (!isRecord(parsed)) {
    throw new SkillMdError('SKILL.md frontmatter must be an object.')
  }

  const name = readRequiredString(parsed, 'name')
  const description = readRequiredString(parsed, 'description')
  return { name, description }
}

function readRequiredString(
  data: Record<string, unknown>,
  key: 'description' | 'name'
): string {
  const value = data[key]
  if (typeof value !== 'string') {
    throw new SkillMdError(`SKILL.md frontmatter must include ${key}.`)
  }
  const trimmed = value.trim()
  if (!trimmed) {
    throw new SkillMdError(`SKILL.md frontmatter ${key} cannot be empty.`)
  }
  return trimmed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
