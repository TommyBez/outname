'use client'

import { useChat } from '@ai-sdk/react'
import type { UIMessage } from 'ai'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai'
import { BotIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Message, MessageContent } from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input'
import { renderMessagePart } from './agent-edit-chat/tool-parts'
import type { AgentEditChatProps } from './agent-edit-chat/types'

export function AgentEditChat({ agentId, currentBudget }: AgentEditChatProps) {
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
                    renderMessagePart({
                      addToolApprovalResponse,
                      currentBudget,
                      key: `${message.id}-${index}`,
                      part,
                      sendMessage,
                    })
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
