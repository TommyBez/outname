'use client'

import { useChat } from '@ai-sdk/react'
import { ChatErrorBanner } from '@outname/ai/chat/components/chat-error-banner'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@outname/ai/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
} from '@outname/ai/components/ai-elements/message'
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@outname/ai/components/ai-elements/prompt-input'
import { apiUrl } from '@outname/shared/api-url'
import type { UIMessage } from 'ai'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai'
import { BotIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MessagePartRenderer } from './agent-edit-chat/tool-parts'
import type { AgentEditChatProps } from './agent-edit-chat/types'

export function AgentEditChat({ agentId, currentBudget }: AgentEditChatProps) {
  const [input, setInput] = useState('')
  const { refresh } = useRouter()
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
      api: apiUrl(`/api/agents/${agentId}/edit/chat`),
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: () => {
      refresh()
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
    <div className="mt-8 flex h-[min(620px,calc(100svh-10rem))] min-h-[24rem] min-w-0 flex-col overflow-hidden border-2 border-foreground bg-background">
      <div className="shrink-0 border-border border-b px-4 py-3 font-bold text-xs uppercase tracking-[0.14em]">
        Edit via chat
      </div>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-6">
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="Example: tighten tone, switch model, and disable dreaming."
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
                  {message.parts.map((part) => (
                    <MessagePartRenderer
                      addToolApprovalResponse={addToolApprovalResponse}
                      currentBudget={currentBudget}
                      key={getMessagePartKey(message.id, part)}
                      part={part}
                      sendMessage={sendMessage}
                    />
                  ))}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="sticky bottom-0 z-10 shrink-0 border-border border-t bg-background p-4">
        {error && <ChatErrorBanner message={error.message} />}
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

function getMessagePartKey(
  messageId: string,
  part: UIMessage['parts'][number]
): string {
  if ('toolCallId' in part) {
    return `${messageId}-${part.type}-${part.toolCallId}`
  }
  if ('sourceId' in part) {
    return `${messageId}-${part.type}-${part.sourceId}`
  }
  if ('id' in part && typeof part.id === 'string') {
    return `${messageId}-${part.type}-${part.id}`
  }
  if (part.type === 'file') {
    return `${messageId}-${part.type}-${part.url}`
  }
  if (part.type === 'text' || part.type === 'reasoning') {
    return `${messageId}-${part.type}-${part.text}`
  }
  return `${messageId}-${part.type}`
}
