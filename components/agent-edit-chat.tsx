'use client'

import { useChat } from '@ai-sdk/react'
import type { ChatAddToolApproveResponseFunction, UIMessage } from 'ai'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai'
import { BotIcon, CheckIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from '@/components/ai-elements/tool'

interface AgentEditChatProps {
  agentId: string
  currentMarkdownFiles: AgentEditMarkdownFiles
  currentSettings: AgentEditSettings
}

interface AgentEditMarkdownFiles {
  identityCard: string
  instructions: string
  soul: string
  userProfile: string
}

interface AgentEditSettings {
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  model: string
  name: string
  reflectionEnabled: boolean
  reflectionIntervalMinutes: number
  stepLimitCustom: null | number
  stepLimitMode: 'custom' | 'grind' | 'high' | 'low' | 'medium'
}

const MARKDOWN_FILE_FIELDS = [
  { key: 'identityCard', path: 'IDENTITY.md', title: 'Identity card' },
  { key: 'soul', path: 'SOUL.md', title: 'Soul' },
  { key: 'instructions', path: 'AGENTS.md', title: 'Instructions' },
  { key: 'userProfile', path: 'USER.md', title: 'User profile' },
] as const

type MarkdownFileKey = (typeof MARKDOWN_FILE_FIELDS)[number]['key']
const TOOL_PREFIX_PATTERN = /^tool-/

const SETTINGS_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'model', label: 'Model' },
  { key: 'heartbeatEnabled', label: 'Heartbeat' },
  { key: 'heartbeatIntervalMinutes', label: 'Heartbeat interval' },
  { key: 'reflectionEnabled', label: 'Reflection' },
  { key: 'reflectionIntervalMinutes', label: 'Reflection interval' },
  { key: 'stepLimitMode', label: 'Step limit' },
  { key: 'stepLimitCustom', label: 'Custom step limit' },
] as const

type SettingsKey = (typeof SETTINGS_FIELDS)[number]['key']

interface MarkdownChange {
  addedLineCount: number
  current: string
  path: string
  proposed: string
  removedLineCount: number
  title: string
}

interface DiffLine {
  count?: number
  id: string
  kind: 'added' | 'context' | 'omitted' | 'removed'
  text: string
}

type RawDiffLine = Omit<DiffLine, 'id'>

interface SettingsChange {
  current: string
  label: string
  proposed: string
}

export function AgentEditChat({
  agentId,
  currentMarkdownFiles,
  currentSettings,
}: AgentEditChatProps) {
  const [input, setInput] = useState('')
  const router = useRouter()
  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    addToolApprovalResponse,
  } = useChat<UIMessage>({
    messages: [],
    transport: new DefaultChatTransport({
      api: `/api/agents/${agentId}/edit/chat`,
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: () => {
      router.refresh()
    },
  })
  const isBusy = status === 'submitted' || status === 'streaming'

  function handleSubmit(message: PromptInputMessage) {
    const text = (message.text ?? '').trim()
    if (!text || isBusy) {
      return
    }
    sendMessage({ text })
    setInput('')
  }

  return (
    <div className="mt-8 flex h-[min(620px,calc(100vh-8rem))] min-h-[420px] min-w-0 flex-col overflow-hidden border-2 border-foreground bg-background">
      <div className="shrink-0 border-border border-b px-4 py-3 font-bold text-xs uppercase tracking-[0.14em]">
        Edit via chat
      </div>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-6">
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="Example: tighten tone, switch model, and disable reflection."
              icon={<BotIcon className="size-6" />}
              title="Describe what to change"
            />
          ) : (
            messages.map((message) => (
              <Message
                from={message.role === 'user' ? 'user' : 'assistant'}
                key={message.id}
              >
                <MessageContent>
                  {message.parts.map((part, index) =>
                    renderMessagePart(
                      part,
                      `${message.id}-${index}`,
                      addToolApprovalResponse,
                      currentMarkdownFiles,
                      currentSettings
                    )
                  )}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {error ? (
        <p className="shrink-0 px-4 py-2 text-destructive text-xs">
          {error.message}
        </p>
      ) : null}
      <div className="shrink-0 border-border border-t p-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            disabled={isBusy}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Tell me what to update..."
            value={input}
          />
          <PromptInputFooter>
            <div />
            <PromptInputSubmit
              disabled={!isBusy && input.trim().length === 0}
              onStop={stop}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

function renderMessagePart(
  part: UIMessage['parts'][number],
  key: string,
  addToolApprovalResponse: ChatAddToolApproveResponseFunction,
  currentMarkdownFiles: AgentEditMarkdownFiles,
  currentSettings: AgentEditSettings
) {
  if (part.type === 'text') {
    return <MessageResponse key={key}>{part.text}</MessageResponse>
  }
  if (part.type === 'dynamic-tool') {
    return (
      <ToolCard
        addToolApprovalResponse={addToolApprovalResponse}
        currentMarkdownFiles={currentMarkdownFiles}
        currentSettings={currentSettings}
        key={key}
        part={part as ToolPart}
      />
    )
  }
  if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
    return (
      <ToolCard
        addToolApprovalResponse={addToolApprovalResponse}
        currentMarkdownFiles={currentMarkdownFiles}
        currentSettings={currentSettings}
        key={key}
        part={part as ToolPart}
      />
    )
  }
  return null
}

function ToolCard({
  part,
  addToolApprovalResponse,
  currentMarkdownFiles,
  currentSettings,
}: {
  addToolApprovalResponse: ChatAddToolApproveResponseFunction
  currentMarkdownFiles: AgentEditMarkdownFiles
  currentSettings: AgentEditSettings
  part: ToolPart
}) {
  const toolName = getToolPartName(part)
  const isAgentEditApproval =
    toolName === 'apply_agent_edit' && part.state === 'approval-requested'

  return (
    <Tool>
      {part.type === 'dynamic-tool' ? (
        <ToolHeader
          state={part.state}
          toolName={(part as { toolName: string }).toolName}
          type="dynamic-tool"
        />
      ) : (
        <ToolHeader
          state={part.state}
          type={part.type as Exclude<ToolPart['type'], 'dynamic-tool'>}
        />
      )}
      <ToolContent>
        {isAgentEditApproval ? (
          <AgentEditApprovalPreview
            currentMarkdownFiles={currentMarkdownFiles}
            currentSettings={currentSettings}
            input={part.input}
          />
        ) : (
          <ToolInput input={part.input} />
        )}
        {part.state === 'approval-requested' ? (
          <ToolApprovalActions
            approvalId={part.approval.id}
            onRespond={addToolApprovalResponse}
          />
        ) : null}
        {part.state === 'output-available' ? (
          <ToolOutput errorText={undefined} output={part.output} />
        ) : null}
        {part.state === 'output-error' ? (
          <ToolOutput errorText={part.errorText} output={undefined} />
        ) : null}
      </ToolContent>
    </Tool>
  )
}

function getToolPartName(part: ToolPart): string {
  if (part.type === 'dynamic-tool') {
    return (part as { toolName: string }).toolName
  }
  return part.type.replace(TOOL_PREFIX_PATTERN, '')
}

function AgentEditApprovalPreview({
  input,
  currentMarkdownFiles,
  currentSettings,
}: {
  currentMarkdownFiles: AgentEditMarkdownFiles
  currentSettings: AgentEditSettings
  input: unknown
}) {
  const changes = getMarkdownChanges(input, currentMarkdownFiles)
  const settingsChanges = getSettingsChanges(input, currentSettings)

  return (
    <section className="space-y-3">
      <div className="border-2 border-foreground bg-background p-3">
        <p className="font-bold text-xs uppercase tracking-[0.16em]">
          Proposed agent edits
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          {formatApprovalSummary(settingsChanges.length, changes.length)}
        </p>
      </div>
      {settingsChanges.length > 0 ? (
        <SettingsChangePreview changes={settingsChanges} />
      ) : null}
      {changes.map((change) => (
        <MarkdownChangePreview change={change} key={change.path} />
      ))}
    </section>
  )
}

function SettingsChangePreview({ changes }: { changes: SettingsChange[] }) {
  return (
    <section className="border-2 border-foreground bg-background">
      <div className="border-foreground border-b-2 px-3 py-2">
        <p className="font-bold text-xs uppercase tracking-[0.16em]">
          Settings
        </p>
      </div>
      <dl className="divide-y divide-border">
        {changes.map((change) => (
          <div
            className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[8rem_minmax(0,1fr)]"
            key={change.label}
          >
            <dt className="font-bold uppercase tracking-[0.12em]">
              {change.label}
            </dt>
            <dd className="min-w-0 font-mono">
              <span className="text-muted-foreground line-through">
                {change.current}
              </span>
              <span className="mx-2 text-muted-foreground">→</span>
              <span>{change.proposed}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function formatApprovalSummary(
  settingsChangeCount: number,
  markdownChangeCount: number
): string {
  const parts: string[] = []
  if (settingsChangeCount > 0) {
    parts.push(
      `${settingsChangeCount} setting ${settingsChangeCount === 1 ? 'change' : 'changes'}`
    )
  }
  if (markdownChangeCount > 0) {
    parts.push(
      `${markdownChangeCount} markdown ${markdownChangeCount === 1 ? 'file' : 'files'}`
    )
  }
  return parts.length > 0
    ? parts.join(' and ')
    : 'No visible settings or markdown files change in this approval.'
}

function MarkdownChangePreview({ change }: { change: MarkdownChange }) {
  const diff = buildCompactLineDiff(change.current, change.proposed)

  return (
    <section className="border-2 border-foreground bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-foreground border-b-2 px-3 py-2">
        <div>
          <p className="font-bold text-xs uppercase tracking-[0.16em]">
            {change.path}
          </p>
          <p className="text-muted-foreground text-xs">{change.title}</p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em]">
          +{change.addedLineCount} / -{change.removedLineCount}
        </p>
      </div>
      <div className="max-h-80 overflow-auto bg-muted/40 p-3 font-mono text-xs leading-5">
        {diff.map((line) => (
          <DiffLineView key={line.id} line={line} />
        ))}
      </div>
    </section>
  )
}

function DiffLineView({ line }: { line: DiffLine }) {
  if (line.kind === 'omitted') {
    return (
      <div className="text-muted-foreground">
        ... {line.count} unchanged {line.count === 1 ? 'line' : 'lines'}
      </div>
    )
  }

  return (
    <div className={getDiffLineClassName(line.kind)}>
      <span className="select-none text-muted-foreground">
        {getDiffLinePrefix(line.kind)}
      </span>{' '}
      <span>{line.text || ' '}</span>
    </div>
  )
}

function getDiffLinePrefix(kind: DiffLine['kind']): string {
  if (kind === 'added') {
    return '+'
  }
  if (kind === 'removed') {
    return '-'
  }
  return ' '
}

function getDiffLineClassName(kind: DiffLine['kind']): string {
  if (kind === 'added') {
    return 'bg-emerald-500/10 text-emerald-900'
  }
  if (kind === 'removed') {
    return 'bg-destructive/10 text-destructive'
  }
  return 'text-foreground'
}

function getMarkdownChanges(
  input: unknown,
  currentMarkdownFiles: AgentEditMarkdownFiles
): MarkdownChange[] {
  if (!isRecord(input)) {
    return []
  }

  const changes: MarkdownChange[] = []
  for (const field of MARKDOWN_FILE_FIELDS) {
    const proposed = readStringField(input, field.key)
    if (proposed === null) {
      continue
    }
    const current = currentMarkdownFiles[field.key]
    if (normalizeMarkdown(current) === normalizeMarkdown(proposed)) {
      continue
    }
    const diffStats = countChangedLines(current, proposed)
    changes.push({
      addedLineCount: diffStats.addedLineCount,
      current,
      path: field.path,
      proposed,
      removedLineCount: diffStats.removedLineCount,
      title: field.title,
    })
  }
  return changes
}

function getSettingsChanges(
  input: unknown,
  currentSettings: AgentEditSettings
): SettingsChange[] {
  if (!isRecord(input)) {
    return []
  }

  const changes: SettingsChange[] = []
  for (const field of SETTINGS_FIELDS) {
    const proposed = input[field.key]
    if (proposed === undefined) {
      continue
    }
    const current = currentSettings[field.key]
    if (
      normalizeComparableValue(current) === normalizeComparableValue(proposed)
    ) {
      continue
    }
    changes.push({
      current: formatSettingValue(field.key, current),
      label: field.label,
      proposed: formatSettingValue(field.key, proposed),
    })
  }
  return changes
}

function readStringField(
  input: Record<string, unknown>,
  key: MarkdownFileKey
): string | null {
  const value = input[key]
  return typeof value === 'string' ? value : null
}

function normalizeComparableValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
}

function formatSettingValue(key: SettingsKey, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'none'
  }
  if (key === 'heartbeatEnabled' || key === 'reflectionEnabled') {
    return value === true ? 'on' : 'off'
  }
  if (
    key === 'heartbeatIntervalMinutes' ||
    key === 'reflectionIntervalMinutes'
  ) {
    return `${value} min`
  }
  return String(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeMarkdown(value: string): string {
  return value.replace(/\r\n?/g, '\n')
}

function splitMarkdownLines(value: string): string[] {
  const normalized = normalizeMarkdown(value)
  return normalized.length === 0 ? [] : normalized.split('\n')
}

function countChangedLines(
  current: string,
  proposed: string
): {
  addedLineCount: number
  removedLineCount: number
} {
  const currentLines = splitMarkdownLines(current)
  const proposedLines = splitMarkdownLines(proposed)
  const bounds = getChangedBounds(currentLines, proposedLines)
  return {
    addedLineCount: Math.max(0, bounds.proposedEnd - bounds.start + 1),
    removedLineCount: Math.max(0, bounds.currentEnd - bounds.start + 1),
  }
}

function buildCompactLineDiff(current: string, proposed: string): DiffLine[] {
  const currentLines = splitMarkdownLines(current)
  const proposedLines = splitMarkdownLines(proposed)
  const bounds = getChangedBounds(currentLines, proposedLines)
  const lines: RawDiffLine[] = []
  const contextStart = Math.max(0, bounds.start - 2)

  if (contextStart > 0) {
    lines.push({ kind: 'omitted', text: '', count: contextStart })
  }
  appendLines(lines, currentLines.slice(contextStart, bounds.start), 'context')
  appendLimitedLines(
    lines,
    currentLines.slice(bounds.start, bounds.currentEnd + 1),
    'removed'
  )
  appendLimitedLines(
    lines,
    proposedLines.slice(bounds.start, bounds.proposedEnd + 1),
    'added'
  )

  const suffixStart = bounds.proposedEnd + 1
  const suffixEnd = Math.min(proposedLines.length, suffixStart + 2)
  appendLines(lines, proposedLines.slice(suffixStart, suffixEnd), 'context')
  if (suffixEnd < proposedLines.length) {
    lines.push({
      kind: 'omitted',
      text: '',
      count: proposedLines.length - suffixEnd,
    })
  }
  const diffLines =
    lines.length > 0
      ? lines
      : ([{ kind: 'context', text: 'No line changes' }] satisfies RawDiffLine[])
  return withStableDiffLineIds(diffLines)
}

function getChangedBounds(currentLines: string[], proposedLines: string[]) {
  let start = 0
  while (
    start < currentLines.length &&
    start < proposedLines.length &&
    currentLines[start] === proposedLines[start]
  ) {
    start += 1
  }

  let currentEnd = currentLines.length - 1
  let proposedEnd = proposedLines.length - 1
  while (
    currentEnd >= start &&
    proposedEnd >= start &&
    currentLines[currentEnd] === proposedLines[proposedEnd]
  ) {
    currentEnd -= 1
    proposedEnd -= 1
  }

  return { currentEnd, proposedEnd, start }
}

function appendLines(
  target: RawDiffLine[],
  source: string[],
  kind: RawDiffLine['kind']
): void {
  for (const line of source) {
    target.push({ kind, text: line })
  }
}

function appendLimitedLines(
  target: RawDiffLine[],
  source: string[],
  kind: RawDiffLine['kind']
): void {
  const visibleLines = source.slice(0, 12)
  appendLines(target, visibleLines, kind)
  if (visibleLines.length < source.length) {
    target.push({
      kind: 'omitted',
      text: '',
      count: source.length - visibleLines.length,
    })
  }
}

function withStableDiffLineIds(lines: RawDiffLine[]): DiffLine[] {
  const seenIds = new Map<string, number>()
  return lines.map((line) => {
    const baseId = `${line.kind}:${line.count ?? ''}:${line.text}`
    const occurrence = seenIds.get(baseId) ?? 0
    seenIds.set(baseId, occurrence + 1)
    return {
      ...line,
      id: `${baseId}:${occurrence}`,
    }
  })
}

function ToolApprovalActions({
  approvalId,
  onRespond,
}: {
  approvalId: string
  onRespond: ChatAddToolApproveResponseFunction
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-2 border-foreground bg-muted p-3">
      <button
        className="inline-flex h-10 items-center justify-center gap-2 border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground"
        onClick={() =>
          onRespond({
            id: approvalId,
            approved: true,
            reason: 'User approved this edit operation.',
          })
        }
        type="button"
      >
        <CheckIcon className="size-4" />
        Approve
      </button>
      <button
        className="inline-flex h-10 items-center justify-center gap-2 border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background"
        onClick={() =>
          onRespond({
            id: approvalId,
            approved: false,
            reason: 'User denied this edit operation.',
          })
        }
        type="button"
      >
        <XIcon className="size-4" />
        Deny
      </button>
    </div>
  )
}
