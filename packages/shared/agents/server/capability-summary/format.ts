import type { AttachedCapability, SummaryContext } from './types'
import { SUMMARY_BOOTSTRAP_PATH } from './types'

const SUB_AGENT_NAME_PREFIX = /^Sub-agent:\s*/i
const SUMMARY_MAX_CHARS = 450
const SUMMARY_TRUNCATION_MIN_RATIO = 0.75
const CONTEXT_MAX_CHARS = 1800

const DISALLOWED_SUMMARY_DETAILS = [
  /\baudit trail\b/i,
  /\bdatabase\b/i,
  /\bfile names?\b/i,
  /\blogs?\b/i,
  /\bmemory\b/i,
  /\bmessage identifiers?\b/i,
  /\bmessage ids?\b/i,
  /\bpersistence\b/i,
  /\bsecrets?\b/i,
  /\btimestamps?\b/i,
  /\bapi keys?\b/i,
]

export function formatSummaryPrompt(context: SummaryContext): string {
  return [
    `Agent being summarized: ${context.name}`,
    `Write about ${context.name}, not about an attached sub-agent.`,
    '',
    `${SUMMARY_BOOTSTRAP_PATH}:`,
    clipText(context.agentsMd) || '(none provided)',
    '',
    'Attached tools and sub-agents:',
    formatAttachedCapabilities(context.attached),
  ].join('\n')
}

export function fallbackSummary(context: SummaryContext): string {
  const toolNames = context.attached
    .map((item) => item.name.replace(SUB_AGENT_NAME_PREFIX, ''))
    .slice(0, 4)
  if (toolNames.length === 0) {
    return `${context.name} is a general-purpose sub-agent for delegated research, planning, and execution.`
  }
  return `${context.name} is a sub-agent for delegated work that can draw on ${toolNames.join(', ')}.`
}

export function cleanSummary(text: string): string {
  const cleaned = text
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[*_~`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const clipped = truncateSummary(cleaned)
  if (DISALLOWED_SUMMARY_DETAILS.some((pattern) => pattern.test(cleaned))) {
    return ''
  }
  return clipped
}

function clipText(text: string): string {
  return text.trim().slice(0, CONTEXT_MAX_CHARS)
}

function formatAttachedCapabilities(attached: AttachedCapability[]): string {
  if (attached.length === 0) {
    return '(none)'
  }
  return attached
    .map((item) => `- ${item.name}: ${item.description}`)
    .join('\n')
    .slice(0, CONTEXT_MAX_CHARS)
}

function truncateSummary(text: string): string {
  if (text.length <= SUMMARY_MAX_CHARS) {
    return text
  }

  const clipped = text.slice(0, SUMMARY_MAX_CHARS).trim()
  const minimumWordBoundary = Math.floor(
    SUMMARY_MAX_CHARS * SUMMARY_TRUNCATION_MIN_RATIO
  )
  const lastSpace = clipped.lastIndexOf(' ')
  const truncated =
    lastSpace >= minimumWordBoundary ? clipped.slice(0, lastSpace) : clipped
  const tidied = truncated.replace(/[,:;\s-]+$/g, '')
  return tidied.endsWith('.') ? tidied : `${tidied}.`
}
