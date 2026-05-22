import type { UIMessage } from 'ai'
import { BotIcon } from 'lucide-react'
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
import { ProposeBudgetCard } from './budget-card'
import { CreateAgentToolCard } from './create-agent-tool-card'
import type {
  AgentCreationMessage,
  CreateAgentToolPart,
  ProposeBudgetToolPart,
  SendMessageFn,
  ToolApprovalResponder,
} from './types'

export function AgentCreationTranscript({
  messages,
  addToolApprovalResponse,
  sendMessage,
  timeZone,
}: {
  addToolApprovalResponse: ToolApprovalResponder
  messages: AgentCreationMessage[]
  sendMessage: SendMessageFn
  timeZone: string
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
              sendMessage={sendMessage}
              timeZone={timeZone}
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
  sendMessage,
  timeZone,
}: {
  addToolApprovalResponse: ToolApprovalResponder
  message: UIMessage
  sendMessage: SendMessageFn
  timeZone: string
}) {
  return (
    <Message from={message.role === 'user' ? 'user' : 'assistant'}>
      <MessageContent>
        {message.parts.map((part, index) =>
          renderAgentCreationPart({
            addToolApprovalResponse,
            key: `${message.id}-${index}`,
            part,
            sendMessage,
            timeZone,
          })
        )}
      </MessageContent>
    </Message>
  )
}

function renderAgentCreationPart(input: {
  addToolApprovalResponse: ToolApprovalResponder
  key: string
  part: UIMessage['parts'][number]
  sendMessage: SendMessageFn
  timeZone: string
}) {
  const { key, part } = input

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
        addToolApprovalResponse={input.addToolApprovalResponse}
        key={key}
        part={part as CreateAgentToolPart}
        timeZone={input.timeZone}
      />
    )
  }
  if (isProposeBudgetToolPart(part)) {
    return (
      <ProposeBudgetCard
        key={key}
        part={part as ProposeBudgetToolPart}
        sendMessage={input.sendMessage}
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
          type={toolPart.type as Exclude<ToolPart['type'], 'dynamic-tool'>}
        />
        <GenericToolBody part={toolPart} />
      </Tool>
    )
  }

  return null
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

function isProposeBudgetToolPart(part: UIMessage['parts'][number]): boolean {
  return part.type === 'tool-propose_agent_budget'
}
