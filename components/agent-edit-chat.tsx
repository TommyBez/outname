'use client'

import { useChat } from '@ai-sdk/react'
import type { UIMessage } from 'ai'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai'
import { BotIcon } from 'lucide-react'
import { useState } from 'react'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
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
}

export function AgentEditChat({ agentId }: AgentEditChatProps) {
  const [input, setInput] = useState('')
  const { messages, sendMessage, status, stop, error } = useChat<UIMessage>({
    messages: [],
    transport: new DefaultChatTransport({
      api: `/api/agents/${agentId}/edit/chat`,
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
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
    <div className="mt-8 border-2 border-foreground">
      <div className="border-border border-b px-4 py-3 font-bold text-xs uppercase tracking-[0.14em]">
        Edit via chat
      </div>
      <Conversation className="max-h-[420px] min-h-[280px]">
        <ConversationContent>
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
                  {message.parts.map((part, index) => {
                    const key = `${message.id}-${index}`
                    if (part.type === 'text') {
                      return (
                        <MessageResponse key={key}>{part.text}</MessageResponse>
                      )
                    }
                    if (
                      part.type === 'dynamic-tool' ||
                      part.type.startsWith('tool-')
                    ) {
                      const toolPart = part as ToolPart
                      return (
                        <Tool key={key}>
                          <ToolHeader
                            state={toolPart.state}
                            type={toolPart.type as ToolPart['type']}
                          />
                          <ToolContent>
                            {toolPart.input ? (
                              <ToolInput input={toolPart.input} />
                            ) : null}
                            {toolPart.output ? (
                              <ToolOutput output={toolPart.output} />
                            ) : null}
                          </ToolContent>
                        </Tool>
                      )
                    }
                    return null
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
      </Conversation>
      {error ? (
        <p className="px-4 py-2 text-destructive text-xs">{error.message}</p>
      ) : null}
      <div className="border-border border-t p-4">
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
