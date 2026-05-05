'use client'

import { useChat } from '@ai-sdk/react'
import type { UIMessage } from 'ai'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai'
import {
  AlertTriangleIcon,
  BotIcon,
  CheckIcon,
  CircleDashedIcon,
  XIcon,
} from 'lucide-react'
import Link from 'next/link'
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
import { Button } from '@/components/ui/button'
import type {
  AgentCreationRequest,
  AgentCreationResult,
} from '@/lib/agent-creation-types'
import { cn } from '@/lib/utils'

type AgentCreationMessage = UIMessage

interface CreateAgentToolPart {
  approval?: {
    approved?: boolean
    id: string
    reason?: string
  }
  errorText?: string
  input: AgentCreationRequest | undefined
  output?: AgentCreationResult
  state: ToolPart['state']
  toolCallId: string
  type: 'tool-create_requested_agent'
}

interface AgentCreationChatProps {
  className?: string
}

export function AgentCreationChat({ className }: AgentCreationChatProps) {
  const [input, setInput] = useState('')
  const router = useRouter()
  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    addToolApprovalResponse,
  } = useChat<AgentCreationMessage>({
    messages: [],
    transport: new DefaultChatTransport({
      api: '/api/agent-creation/chat',
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
    <div
      className={cn(
        'flex min-h-[min(720px,calc(100vh-18rem))] min-w-0 flex-col overflow-hidden border-2 border-foreground bg-background',
        className
      )}
    >
      <AgentCreationTranscript
        addToolApprovalResponse={addToolApprovalResponse}
        messages={messages}
      />

      {error && (
        <p
          className="mx-4 mb-2 border-2 border-destructive bg-destructive px-3 py-2 font-bold text-destructive-foreground text-xs uppercase tracking-[0.12em]"
          role="alert"
        >
          {error.message || 'Something went wrong. Try again.'}
        </p>
      )}

      <div className="px-4 pb-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            disabled={isBusy}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Describe the agent you want to create..."
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

function AgentCreationTranscript({
  messages,
  addToolApprovalResponse,
}: {
  addToolApprovalResponse: (input: {
    approved: boolean
    id: string
    reason?: string
  }) => void | PromiseLike<void>
  messages: AgentCreationMessage[]
}) {
  return (
    <Conversation className="min-h-0 flex-1">
      <ConversationContent className="gap-6">
        {messages.length === 0 ? (
          <ConversationEmptyState
            description="Tell me the job, tone, and tools this agent should have."
            icon={<BotIcon className="size-8" />}
            title="Design a new agent"
          />
        ) : (
          messages.map((message) => (
            <AgentCreationMessageView
              addToolApprovalResponse={addToolApprovalResponse}
              key={message.id}
              message={message}
            />
          ))
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}

function AgentCreationMessageView({
  message,
  addToolApprovalResponse,
}: {
  addToolApprovalResponse: (input: {
    approved: boolean
    id: string
    reason?: string
  }) => void | PromiseLike<void>
  message: UIMessage
}) {
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
              <Reasoning isStreaming={part.state === 'streaming'} key={key}>
                <ReasoningTrigger />
                <ReasoningContent>{part.text}</ReasoningContent>
              </Reasoning>
            )
          }

          if (isCreateAgentToolPart(part)) {
            return (
              <CreateAgentToolCard
                addToolApprovalResponse={addToolApprovalResponse}
                key={key}
                part={part as CreateAgentToolPart}
              />
            )
          }

          if (part.type === 'dynamic-tool') {
            const toolPart = part as ToolPart
            return (
              <Tool key={key}>
                <ToolHeader
                  state={toolPart.state}
                  toolName={(toolPart as { toolName: string }).toolName}
                  type="dynamic-tool"
                />
                <GenericToolBody part={toolPart} />
              </Tool>
            )
          }

          if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
            const toolPart = part as ToolPart
            return (
              <Tool key={key}>
                <ToolHeader
                  state={toolPart.state}
                  type={
                    toolPart.type as Exclude<ToolPart['type'], 'dynamic-tool'>
                  }
                />
                <GenericToolBody part={toolPart} />
              </Tool>
            )
          }

          return null
        })}
      </MessageContent>
    </Message>
  )
}

function CreateAgentToolCard({
  part,
  addToolApprovalResponse,
}: {
  addToolApprovalResponse: (input: {
    approved: boolean
    id: string
    reason?: string
  }) => void | PromiseLike<void>
  part: CreateAgentToolPart
}) {
  if (part.state === 'input-streaming' || part.state === 'input-available') {
    return (
      <div className="w-full border-2 border-foreground bg-muted p-4">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-[0.16em]">
          <CircleDashedIcon className="size-4 animate-spin" />
          Preparing configuration
        </div>
      </div>
    )
  }

  if (part.state === 'approval-requested') {
    return (
      <FinalConfigurationCard
        config={part.input}
        onApprove={() =>
          addToolApprovalResponse({
            id: part.approval?.id ?? '',
            approved: true,
            reason: 'User approved agent creation.',
          })
        }
        onDeny={() =>
          addToolApprovalResponse({
            id: part.approval?.id ?? '',
            approved: false,
            reason: 'User denied agent creation and wants changes.',
          })
        }
      />
    )
  }

  if (part.state === 'approval-responded') {
    return (
      <div className="w-full border-2 border-foreground bg-muted p-4">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-[0.16em]">
          {part.approval?.approved ? (
            <CheckIcon className="size-4" />
          ) : (
            <XIcon className="size-4" />
          )}
          {part.approval?.approved ? 'Approved' : 'Denied'}
        </div>
      </div>
    )
  }

  if (part.state === 'output-available' && part.output) {
    return <CreationSuccessCard result={part.output} />
  }

  if (part.state === 'output-denied') {
    return (
      <div className="w-full border-2 border-foreground bg-muted p-4">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-[0.16em]">
          <XIcon className="size-4" />
          Creation denied
        </div>
      </div>
    )
  }

  if (part.state === 'output-error') {
    return (
      <div className="w-full border-2 border-destructive bg-destructive/5 p-4">
        <div className="flex items-center gap-2 font-bold text-destructive text-xs uppercase tracking-[0.16em]">
          <AlertTriangleIcon className="size-4" />
          Creation failed
        </div>
        <p className="mt-2 text-destructive text-sm">
          {part.errorText ?? 'The agent was not created.'}
        </p>
      </div>
    )
  }

  return null
}

function FinalConfigurationCard({
  config,
  onApprove,
  onDeny,
}: {
  config: AgentCreationRequest | undefined
  onApprove: () => void
  onDeny: () => void
}) {
  if (!config) {
    return null
  }

  const maintainerTools = config.tools?.maintainer ?? []
  const subAgents = config.tools?.subAgents ?? []

  return (
    <section className="w-full border-2 border-foreground bg-background">
      <div className="border-foreground border-b-2 bg-accent px-4 py-3">
        <p className="font-bold text-xs uppercase tracking-[0.18em]">
          Review before creation
        </p>
      </div>
      <div className="grid gap-5 p-4 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-5">
          <div>
            <p className="font-black font-serif text-3xl uppercase leading-none tracking-tighter">
              {config.name}
            </p>
            <p className="mt-2 text-muted-foreground text-sm">{config.role}</p>
          </div>

          <ReviewBlock label="Behavior" value={config.behavior} />
          <ReviewBlock
            label="Runtime"
            value={[
              `Model: ${config.model}`,
              `Step limit: ${stepLimitLabel(config.stepLimit)}`,
              `Heartbeat: ${scheduleLabel(config.heartbeat)}`,
              `Reflection: ${scheduleLabel(config.reflection)}`,
            ].join('\n')}
          />
          <ReviewBlock
            label="Memory seeds"
            value={[
              config.identityCard ? 'IDENTITY.md prepared' : null,
              config.soul ? 'SOUL.md prepared' : null,
              config.instructions
                ? 'AGENTS.md custom instructions prepared'
                : null,
              config.userProfile ? 'USER.md prepared' : null,
            ]
              .filter(Boolean)
              .join('\n')}
          />
        </div>

        <aside className="space-y-4 border-foreground border-t-2 pt-4 md:border-t-0 md:border-l-2 md:pt-0 md:pl-4">
          <div>
            <p className="font-bold text-xs uppercase tracking-[0.16em]">
              Tools
            </p>
            {maintainerTools.length === 0 && subAgents.length === 0 ? (
              <p className="mt-2 text-muted-foreground text-sm">
                No optional tools
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {maintainerTools.map((tool) => (
                  <li
                    className="border border-border px-2 py-1 font-mono text-xs"
                    key={tool.toolId}
                  >
                    {tool.toolId}
                  </li>
                ))}
                {subAgents.map((tool) => (
                  <li
                    className="border border-border px-2 py-1 font-mono text-xs"
                    key={tool.childAgentId}
                  >
                    agent:{tool.childAgentId}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={onApprove} type="button">
              <CheckIcon className="size-4" />
              Create agent
            </Button>
            <Button onClick={onDeny} type="button" variant="outline">
              <XIcon className="size-4" />
              Keep editing
            </Button>
          </div>
        </aside>
      </div>
    </section>
  )
}

function CreationSuccessCard({ result }: { result: AgentCreationResult }) {
  const failedAttachments = result.attachments.filter((item) => !item.ok)
  const pendingAttachments = result.attachments.filter(
    (item) => item.status === 'pending'
  )

  return (
    <section className="w-full border-2 border-foreground bg-background">
      <div className="border-foreground border-b-2 bg-foreground px-4 py-3 text-background">
        <p className="font-bold text-xs uppercase tracking-[0.18em]">
          Agent ready
        </p>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <p className="font-black font-serif text-3xl uppercase leading-none tracking-tighter">
            {result.name}
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            {result.created
              ? 'Created and queued for its first sandbox boot.'
              : 'Already created from this approval; showing the existing agent.'}
          </p>
        </div>

        {pendingAttachments.length > 0 && (
          <p className="border-2 border-foreground bg-muted px-3 py-2 text-sm">
            {pendingAttachments.length} tool environment{' '}
            {pendingAttachments.length === 1 ? 'is' : 'are'} building.
          </p>
        )}

        {failedAttachments.length > 0 && (
          <div className="border-2 border-destructive bg-destructive/5 px-3 py-2 text-destructive text-sm">
            <p className="font-bold">Some tools were not attached.</p>
            <ul className="mt-2 list-disc pl-4">
              {failedAttachments.map((item) => (
                <li key={`${item.kind}-${item.toolId}`}>
                  {item.toolId}: {item.error ?? 'Unknown error'}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={result.overviewUrl}>Open agent</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={result.editUrl}>Review config</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={result.toolsUrl}>Tools</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function ReviewBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-foreground border-t-2 pt-3">
      <p className="font-bold text-xs uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
        {value || 'None'}
      </p>
    </div>
  )
}

function GenericToolBody({ part }: { part: ToolPart }) {
  return (
    <ToolContent>
      <ToolInput input={part.input} />
      {part.state === 'output-available' && (
        <ToolOutput errorText={undefined} output={part.output} />
      )}
      {part.state === 'output-error' && (
        <ToolOutput errorText={part.errorText} output={undefined} />
      )}
    </ToolContent>
  )
}

function isCreateAgentToolPart(part: UIMessage['parts'][number]): boolean {
  return part.type === 'tool-create_requested_agent'
}

function scheduleLabel(schedule: AgentCreationRequest['heartbeat']): string {
  if (!schedule.enabled) {
    return 'off'
  }
  return `every ${schedule.intervalMinutes} minutes`
}

function stepLimitLabel(stepLimit: AgentCreationRequest['stepLimit']): string {
  if (stepLimit.mode !== 'custom') {
    return stepLimit.mode
  }
  return `custom (${stepLimit.custom ?? 30})`
}
