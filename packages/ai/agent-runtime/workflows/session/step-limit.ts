import { isStepCount, type StepResult, type ToolSet, type UIMessage } from 'ai'

const DEFAULT_STEP_LIMIT = 30
const HIGH_STEP_LIMIT = 50
const LOW_STEP_LIMIT = 10

export type StepLimitMode = 'custom' | 'grind' | 'high' | 'low' | 'medium'

interface StepLimitInput {
  custom: number | null
  mode: StepLimitMode
}

export function resolveStepLimitCount(input: StepLimitInput): number | null {
  if (input.mode === 'grind') {
    return null
  }
  if (input.mode === 'low') {
    return LOW_STEP_LIMIT
  }
  if (input.mode === 'high') {
    return HIGH_STEP_LIMIT
  }
  if (input.mode === 'custom') {
    return Math.max(1, Math.floor(input.custom ?? DEFAULT_STEP_LIMIT))
  }
  return DEFAULT_STEP_LIMIT
}

export function resolveStepLimit(
  input: StepLimitInput
): ReturnType<typeof isStepCount> | undefined {
  const limit = resolveStepLimitCount(input)
  return limit === null ? undefined : isStepCount(limit)
}

export function didReachStepLimit<TOOLS extends ToolSet>(
  input: StepLimitInput & {
    steps: readonly StepResult<TOOLS>[]
  }
): boolean {
  const limit = resolveStepLimitCount(input)
  if (limit === null || input.steps.length !== limit) {
    return false
  }
  const lastStep = input.steps.at(-1)
  return lastStep?.finishReason === 'tool-calls'
}

export function buildStepLimitNotice(input: StepLimitInput): string {
  const limit = resolveStepLimitCount(input)
  if (limit === null) {
    return 'I reached my current step limit, so I am stopping here. Any queued cleanup and saves will be finalized before this turn ends.'
  }
  return `I reached my step limit (${limit}), so I am stopping here. Any queued cleanup and saves will be finalized before this turn ends.`
}

export function appendStepLimitNoticeToOutput(
  output: string | null,
  notice: string
): string {
  const trimmed = output?.trim() ?? ''
  return trimmed.length > 0 ? `${trimmed}\n\n${notice}` : notice
}

export function appendStepLimitNoticeToMessages(
  messages: readonly UIMessage[],
  notice: string
): UIMessage[] {
  const lastMessage = messages.at(-1)
  if (lastMessage?.role === 'assistant') {
    const hasAssistantText = lastMessage.parts.some(
      (part) => part.type === 'text' && part.text.trim().length > 0
    )
    return [
      ...messages.slice(0, -1),
      {
        ...lastMessage,
        parts: [
          ...lastMessage.parts,
          {
            type: 'text',
            text: `${hasAssistantText ? '\n\n' : ''}${notice}`,
          },
        ],
      },
    ]
  }
  return [
    ...messages,
    {
      id: stepLimitMessageId(),
      role: 'assistant',
      parts: [{ type: 'text', text: notice }],
    },
  ]
}

function stepLimitMessageId(): string {
  return `step_limit_${Math.random().toString(36).slice(2, 10)}`
}
