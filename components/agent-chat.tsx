'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useEffect, useRef, useState } from 'react'
import {
  AgentChatTranscript,
  hasAssistantContentAfterLatestUser,
} from '@/components/agent-chat-transcript'
import { revalidateConversations } from '@/components/agent-sidebar-workspace'
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input'
import {
  type AgentChatMessage,
  CHAT_STATUS_PART_TYPE,
  type WorkflowStatusData,
} from '@/lib/agent-chat-status'

interface AgentChatProps {
  agentId: string
  /** Stable id for the conversation this chat targets. For draft chats
   * this is a server-generated candidate id that will only be persisted
   * on the first user message; for existing conversations it's the real
   * row id. */
  conversationId: string
  initialMessages: AgentChatMessage[]
  /** When true, the chat was mounted at `/chat/new` with a candidate id
   * that the DB does not yet know about. On the first successful send
   * we swap the URL to the canonical `/chat/:id` route so a refresh
   * lands on the persisted conversation. */
  isDraft?: boolean
}

/**
 * Client-side chat surface. Owns the `useChat` transport, the draft input,
 * and per-part rendering of assistant turns (text, tool calls, reasoning).
 *
 * The transport targets a per-agent endpoint (`/api/agents/:id/chat`) so
 * server-side identity is derived from the session, not the request body.
 * `conversationId` is forwarded in the POST body so the API route can
 * lazily create the row on first message.
 */
export function AgentChat({
  agentId,
  conversationId,
  initialMessages,
  isDraft,
}: AgentChatProps) {
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
        // Ask the sidebar to refetch its own list so the new row + title
        // appear. This replaces the previous `router.refresh()` call,
        // which re-rendered the whole RSC tree under Next 16's cache
        // components and could strand the freshly streamed assistant
        // message out of view on soft navigation.
        await revalidateConversations(agentId)
      },
    })

  // Draft → persisted URL swap. We do this in `history.replaceState`
  // instead of `router.replace` because the latter would unmount the
  // streaming `useChat` instance and strand the in-flight turn. Running
  // this effect the moment a message exists (before the assistant even
  // finishes) keeps the address bar honest during the first turn.
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

  // PromptInput's onSubmit contract: AI Elements gathers files + the
  // textarea text and hands us a structured `PromptInputMessage`.
  // The raw FormEvent is the second argument and we do NOT need to call
  // preventDefault on it — the component already does.
  function handleSubmit(message: PromptInputMessage) {
    const text = (message.text ?? '').trim()
    if (!text || isBusy) {
      return
    }
    setWorkflowStatus(null)
    sendMessage({ text })
    setInput('')
  }

  return (
    // Full-height flex column so the composer pins to the bottom of
    // whatever container mounts us (today: `<ChatFrame>`, which is
    // inside AppShell's padded main column). `min-w-0` + `overflow-hidden`
    // keep wide tool output (tables, code blocks) contained without
    // stretching the chat column past the viewport edge.
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <AgentChatTranscript
        emptyDescription="Ask this agent anything — it has the same tools the scheduled run does."
        emptyTitle="Start a conversation"
        messages={messages}
        workflowStatus={showWorkflowStatus ? workflowStatus : null}
      />

      {error && (
        <p
          className="mb-2 border-2 border-destructive bg-destructive px-3 py-2 font-bold text-destructive-foreground text-xs uppercase tracking-[0.12em]"
          role="alert"
        >
          {error.message || 'Something went wrong. Try again.'}
        </p>
      )}

      <PromptInput className="mt-4" onSubmit={handleSubmit}>
        <PromptInputTextarea
          disabled={isBusy}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about your inbox…"
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
