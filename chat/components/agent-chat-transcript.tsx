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
        {messages.length === 0 ? (
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
              // No negative horizontal margin here: on narrow viewports
              // it was shifting the Reasoning trigger (brain icon + label)
              // past `MessageContent`'s `overflow-hidden` clip and cutting
              // off the icon on the left edge.
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

function WorkflowStatusMessage({ status }: { status: WorkflowStatusData }) {
  return (
    <Message from="assistant">
      <MessageContent>
        <div className="flex items-center gap-2 border-2 border-border bg-muted/40 px-3 py-3 font-medium text-muted-foreground text-xs uppercase leading-5 tracking-[0.12em]">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          <span>{status.message}</span>
        </div>
      </MessageContent>
    </Message>
  )
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-border border-b pb-2">
        <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Sub-agent trace
        </h4>
        <span className="font-medium text-muted-foreground text-xs">
          {formatSubAgentStatus(output)}
        </span>
      </div>
      {hasMessages ? (
        <div className="space-y-3 border-border border-l-2 pl-3">
          {output.messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {getSubAgentEmptyText(output)}
        </p>
      )}
    </div>
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
