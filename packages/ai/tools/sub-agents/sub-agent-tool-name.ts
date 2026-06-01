import { AGENT_TOOL_PREFIX } from './agent-tool-prefix'

const MAX_TOOL_NAME_LENGTH = 64
const FALLBACK_SLUG = 'subagent'
const SUFFIX_LENGTH = 6

function baseSubAgentToolId(childName: string): string {
  const slug = slugifyAgentName(childName)
  return `${AGENT_TOOL_PREFIX}${slug}`.slice(0, MAX_TOOL_NAME_LENGTH)
}

export function uniqueSubAgentToolId(input: {
  childAgentId: string
  childName: string
  usedToolIds: Set<string>
}): string {
  const base = baseSubAgentToolId(input.childName)
  if (!input.usedToolIds.has(base)) {
    return base
  }

  const suffix = stableSuffix(input.childAgentId)
  const suffixed = fitWithSuffix(base, suffix)
  if (!input.usedToolIds.has(suffixed)) {
    return suffixed
  }

  let counter = 2
  while (counter < 100) {
    const candidate = fitWithSuffix(base, `${suffix}_${counter}`)
    if (!input.usedToolIds.has(candidate)) {
      return candidate
    }
    counter += 1
  }

  return fitWithSuffix(base, `${suffix}_${Date.now().toString(36).slice(-4)}`)
}

function legacySubAgentToolId(childAgentId: string): string {
  return `${AGENT_TOOL_PREFIX}${childAgentId}`
}

export function isLegacySubAgentToolId(input: {
  childAgentId: string
  toolId: string
}): boolean {
  return input.toolId === legacySubAgentToolId(input.childAgentId)
}

export function childAgentIdFromSubAgentRow(input: {
  config: unknown
  toolId: string
}): string {
  const configChildId = childAgentIdFromConfig(input.config)
  if (configChildId) {
    return configChildId
  }
  return input.toolId.startsWith(AGENT_TOOL_PREFIX)
    ? input.toolId.slice(AGENT_TOOL_PREFIX.length)
    : input.toolId
}

function childAgentIdFromConfig(config: unknown): string | null {
  if (!(typeof config === 'object' && config !== null)) {
    return null
  }
  const childAgentId = (config as { childAgentId?: unknown }).childAgentId
  return typeof childAgentId === 'string' && childAgentId.length > 0
    ? childAgentId
    : null
}

function slugifyAgentName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')

  return slug.length > 0 ? slug : FALLBACK_SLUG
}

function stableSuffix(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return (cleaned || FALLBACK_SLUG).slice(-SUFFIX_LENGTH)
}

function fitWithSuffix(base: string, suffix: string): string {
  const separator = '_'
  const suffixPart = `${separator}${suffix}`
  const maxBaseLength = MAX_TOOL_NAME_LENGTH - suffixPart.length
  return `${base.slice(0, Math.max(1, maxBaseLength))}${suffixPart}`
}
