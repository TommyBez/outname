'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { MessageSquarePlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  type AgentChatMessage,
  CHAT_STATUS_PART_TYPE,
  type WorkflowStatusData,
} from '@/agent-runtime/server/chat-status'
import {
  AgentChatTranscript,
  hasAssistantContentAfterLatestUser,
} from '@/chat/components/agent-chat-transcript'
import { refreshConversationList } from '@/chat/components/agent-sidebar-workspace/conversations'
import { ChatErrorBanner } from '@/chat/components/chat-error-banner'
import { newChatConversationId } from '@/chat/lib/new-chat-conversation-id'
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { useAiGatewayKeyGate } from '@/shared/components/ai-gateway-key-gate/ai-gateway-key-gate-provider'

interface AgentChatProps {
  agentId: string
  // Draft chats get a candidate id here; persisted chats get the real row id.
  conversationId: string
  initialMessages: AgentChatMessage[]
  // Draft chats start at `/chat/new` and swap to the canonical route on first send.
  isDraft?: boolean
}

// Client chat surface for one agent. Session auth stays server-side, while
// `conversationId` in the POST body lets the route create the row lazily on the
// first user turn.
export function AgentChat({
  agentId,
  conversationId,
  initialMessages,
  isDraft,
}: AgentChatProps) {
  const router = useRouter()
  const { requireAiGatewayKey } = useAiGatewayKeyGate()
  const [input, setInput] = useState('')
  const [workflowStatus, setWorkflowStatus] =
    useState<WorkflowStatusData | null>(null)
  const didPromoteDraftRef = useRef(false)
  const { messages, sendMessage, status, error, stop } =
    useChat<AgentChatMessage>({
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: `/api/agents/${agentId}/chat`,
        body: { conversationId },
      }),
      onData: (part) => {
        if (isWorkflowStatusPart(part)) {
          setWorkflowStatus(part.data)
        }
      },
      onFinish: async () => {
        setWorkflowStatus(null)
        // Refresh the sidebar list; title generation can finish slightly after the
        // stream closes, so we retry until the row has a title or attempts exhaust.
        await refreshConversationList(agentId, { conversationId })
      },
    })

  // Use `history.replaceState` instead of `router.replace` so the URL updates
  // without remounting `useChat` or flashing the chat surface.
  useEffect(() => {
    if (!isDraft) {
      return
    }
    if (didPromoteDraftRef.current) {
      return
    }
    if (messages.length === 0) {
      return
    }
    didPromoteDraftRef.current = true
    if (typeof window !== 'undefined') {
      window.history.replaceState(
        null,
        '',
        `/agents/${agentId}/chat/${conversationId}`
      )
    }
  }, [agentId, conversationId, isDraft, messages.length])

  const isBusy = status === 'submitted' || status === 'streaming'
  const showWorkflowStatus = isBusy && workflowStatus !== null

  useEffect(() => {
    if (!(workflowStatus && isBusy)) {
      return
    }
    if (hasAssistantContentAfterLatestUser(messages)) {
      setWorkflowStatus(null)
    }
  }, [isBusy, messages, workflowStatus])

  function handleSubmit(message: PromptInputMessage) {
    const text = (message.text ?? '').trim()
    if (!text || isBusy) {
      return
    }
    if (!requireAiGatewayKey()) {
      return
    }
    setWorkflowStatus(null)
    sendMessage({ text })
    setInput('')
  }

  function handleNewChat() {
    router.push(`/agents/${agentId}/chat/new?draft=${newChatConversationId()}`)
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <AgentChatTranscript
        emptyDescription="Ask this agent anything — it has the same tools the scheduled run does."
        emptyTitle="Start a conversation"
        messages={messages}
        workflowStatus={showWorkflowStatus ? workflowStatus : null}
      />

      <div className="sticky bottom-0 z-10 shrink-0 bg-background pt-4">
        {error && <ChatErrorBanner message={error.message} />}

        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            disabled={isBusy}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about your inbox…"
            value={input}
          />
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputButton
                aria-label="New chat"
                onClick={handleNewChat}
                tooltip="New chat"
              >
                <MessageSquarePlus className="size-4" />
              </PromptInputButton>
            </PromptInputTools>
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

function isWorkflowStatusPart(part: {
  data: unknown
  type: string
}): part is { data: WorkflowStatusData; type: typeof CHAT_STATUS_PART_TYPE } {
  if (part.type !== CHAT_STATUS_PART_TYPE) {
    return false
  }
  if (!(typeof part.data === 'object' && part.data !== null)) {
    return false
  }

  const data = part.data as Partial<WorkflowStatusData>
  return (
    typeof data.message === 'string' &&
    typeof data.phase === 'string' &&
    typeof data.timestamp === 'string'
  )
}
