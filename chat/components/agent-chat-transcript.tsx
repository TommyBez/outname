'use client'

import type { UIMessage } from 'ai'
import type {
  AgentChatMessage,
  WorkflowStatusData,
} from '@/agent-runtime/server/chat-status'
import {
  isSubAgentToolOutput,
  type SubAgentToolOutput,
} from '@/agent-runtime/server/sub-agent-tool-output'
import { readEventActivityMetadata } from '@/agent-runtime/shared/event-transcript'
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
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import { Task, TaskContent, TaskTrigger } from '@/components/ai-elements/task'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from '@/components/ai-elements/tool'
import { cn } from '@/lib/utils'

interface AgentChatTranscriptProps {
  className?: string
  emptyDescription: string
  emptyTitle: string
  messages: AgentChatMessage[]
  workflowStatus?: WorkflowStatusData | null
}

export function AgentChatTranscript({
  className,
  emptyDescription,
  emptyTitle,
  messages,
  workflowStatus,
}: AgentChatTranscriptProps) {
  return (
    <Conversation className={cn('min-h-0 flex-1', className)}>
      <ConversationContent>
        {messages.length === 0 && !workflowStatus ? (
          <ConversationEmptyState
            description={emptyDescription}
            title={emptyTitle}
          />
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {workflowStatus && (
              <WorkflowStatusMessage status={workflowStatus} />
            )}
          </>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}

export function hasAssistantContentAfterLatestUser(
  messages: AgentChatMessage[]
) {
  const latestUserIndex = messages.findLastIndex(
    (message) => message.role === 'user'
  )
  if (latestUserIndex < 0) {
    return false
  }

  return messages.slice(latestUserIndex + 1).some(hasVisibleAssistantContent)
}

function ChatMessage({ message }: { message: UIMessage }) {
  const activityMetadata = readEventActivityMetadata(message)
  if (activityMetadata) {
    return (
      <WorkflowStatusMessage
        status={{
          message: readMessageText(message),
          phase: 'agent-stream',
          timestamp: activityMetadata.timestamp,
        }}
        tone={activityMetadata.tone}
        transient={activityMetadata.transient}
      />
    )
  }

  return (
    <Message from={message.role === 'user' ? 'user' : 'assistant'}>
      <MessageContent>
        {message.parts.map((part, index) => {
          const key = `${message.id}-${index}`

          if (part.type === 'text') {
            return <MessageResponse key={key}>{part.text}</MessageResponse>
          }

          if (part.type === 'reasoning') {
            return (
              // Keep the trigger inside `MessageContent` on narrow viewports.
              <Reasoning isStreaming={part.state === 'streaming'} key={key}>
                <ReasoningTrigger />
                <ReasoningContent>{part.text}</ReasoningContent>
              </Reasoning>
            )
          }

          // Tool parts: `tool-*` (static) and `dynamic-tool` both satisfy ToolPart.
          // ToolHeader takes a discriminated union on `type` so we branch.
          if (part.type === 'dynamic-tool') {
            const toolPart = part as ToolPart
            const subAgentOutput = getSubAgentOutput(toolPart)
            return (
              <Tool key={key}>
                <ToolHeader
                  preliminary={readPreliminary(toolPart)}
                  state={toolPart.state}
                  title={subAgentOutput?.childName}
                  toolName={
                    // `DynamicToolUIPart` exposes the runtime tool name.
                    (toolPart as { toolName: string }).toolName
                  }
                  type="dynamic-tool"
                />
                <ToolBody part={toolPart} />
              </Tool>
            )
          }

          if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
            const toolPart = part as ToolPart
            const subAgentOutput = getSubAgentOutput(toolPart)
            return (
              <Tool key={key}>
                <ToolHeader
                  preliminary={readPreliminary(toolPart)}
                  state={toolPart.state}
                  title={subAgentOutput?.childName}
                  type={
                    toolPart.type as Exclude<ToolPart['type'], 'dynamic-tool'>
                  }
                />
                <ToolBody part={toolPart} />
              </Tool>
            )
          }

          return null
        })}
      </MessageContent>
    </Message>
  )
}

function WorkflowStatusMessage({
  status,
  tone = 'default',
  transient = true,
}: {
  status: WorkflowStatusData
  tone?: 'default' | 'error'
  transient?: boolean
}) {
  // System-level status: rendered as a standalone row (not a Message), so it
  // does not enter the conversation's aria-log as an assistant turn and does
  // not inherit assistant bubble styling.
  return (
    <div
      aria-live="polite"
      className={cn(
        'flex w-full max-w-[95%] items-center gap-2 border-2 px-3 py-3 font-medium text-xs uppercase leading-5 tracking-[0.12em]',
        tone === 'error'
          ? 'border-destructive bg-destructive/10 text-destructive'
          : 'border-border bg-muted/40 text-muted-foreground'
      )}
      data-transient={transient ? 'true' : undefined}
      role="status"
    >
      <span
        className={cn(
          'size-2 rounded-full',
          tone === 'error' ? 'bg-destructive' : 'animate-pulse bg-primary'
        )}
      />
      <span>{status.message}</span>
    </div>
  )
}

function readMessageText(message: UIMessage): string {
  const text = message.parts
    .map((part) => {
      if (part.type === 'text') {
        return part.text
      }
      return ''
    })
    .join(' ')
    .trim()
  return text || 'Event activity updated'
}

function hasVisibleAssistantContent(message: AgentChatMessage) {
  if (message.role !== 'assistant') {
    return false
  }

  return message.parts.some((part) => {
    if (part.type === 'text' || part.type === 'reasoning') {
      return part.text.trim().length > 0
    }

    return (
      part.type === 'dynamic-tool' ||
      part.type === 'source-url' ||
      part.type === 'source-document' ||
      part.type === 'file' ||
      part.type === 'step-start' ||
      (typeof part.type === 'string' && part.type.startsWith('tool-'))
    )
  })
}

function ToolBody({ part }: { part: ToolPart }) {
  const subAgentOutput = getSubAgentOutput(part)

  return (
    <ToolContent>
      <ToolInput input={part.input} />
      {part.state === 'output-available' && subAgentOutput && (
        <SubAgentToolTrace output={subAgentOutput} />
      )}
      {part.state === 'output-available' && !subAgentOutput && (
        <ToolOutput errorText={undefined} output={part.output} />
      )}
      {part.state === 'output-error' && (
        <ToolOutput errorText={part.errorText} output={undefined} />
      )}
    </ToolContent>
  )
}

function SubAgentToolTrace({ output }: { output: SubAgentToolOutput }) {
  const hasMessages = output.messages.length > 0
  const title = `Sub-agent trace · ${formatSubAgentStatus(output)}`

  return (
    <Task defaultOpen>
      <TaskTrigger title={title} />
      <TaskContent>
        {hasMessages ? (
          output.messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        ) : (
          <p className="text-muted-foreground text-sm">
            {getSubAgentEmptyText(output)}
          </p>
        )}
      </TaskContent>
    </Task>
  )
}

function getSubAgentEmptyText(output: SubAgentToolOutput): string {
  if (output.status !== 'running') {
    return output.finalText ?? output.error ?? 'No trace was captured.'
  }
  return 'Waiting for the sub-agent stream...'
}

function getSubAgentOutput(part: ToolPart): SubAgentToolOutput | null {
  return part.state === 'output-available' && isSubAgentToolOutput(part.output)
    ? part.output
    : null
}

function readPreliminary(part: ToolPart): boolean {
  return (
    part.state === 'output-available' &&
    'preliminary' in part &&
    part.preliminary === true
  )
}

function formatSubAgentStatus(output: SubAgentToolOutput): string {
  switch (output.status) {
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'running':
      return 'running'
    default:
      return 'running'
  }
}
