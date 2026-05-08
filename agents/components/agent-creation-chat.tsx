'use client'

import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
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
        sendMessage={sendMessage}
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
