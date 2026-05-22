'use client'

import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChatErrorBanner } from '@/chat/components/chat-error-banner'
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input'
import { cn } from '@/lib/utils'
import { AgentCreationTranscript } from './agent-creation-chat/transcript'
import type { AgentCreationMessage } from './agent-creation-chat/types'

interface AgentCreationChatProps {
  className?: string
  timeZone: string
}

export function AgentCreationChat({
  className,
  timeZone,
}: AgentCreationChatProps) {
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
        'flex h-[min(720px,calc(100svh-14rem))] min-h-[24rem] min-w-0 flex-col overflow-hidden border-2 border-foreground bg-background',
        className
      )}
    >
      <AgentCreationTranscript
        addToolApprovalResponse={addToolApprovalResponse}
        messages={messages}
        sendMessage={sendMessage}
        timeZone={timeZone}
      />

      <div className="sticky bottom-0 z-10 shrink-0 bg-background px-4 pt-4 pb-4">
        {error && <ChatErrorBanner message={error.message} />}

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
