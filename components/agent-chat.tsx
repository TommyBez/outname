'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useEffect, useRef, useState } from 'react'
import { revalidateConversations } from '@/components/agent-sidebar-workspace'
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
        if (part.type === CHAT_STATUS_PART_TYPE) {
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
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="Ask this agent anything — it has the same tools the scheduled run does."
              title="Start a conversation"
            />
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {showWorkflowStatus && (
                <WorkflowStatusMessage status={workflowStatus} />
              )}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

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
            return (
              <Tool key={key}>
                <ToolHeader
                  state={toolPart.state}
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
            return (
              <Tool key={key}>
                <ToolHeader
                  state={toolPart.state}
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
        <div className="flex items-center gap-2 border-2 border-border bg-muted/40 px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-[0.12em]">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          <span>{status.message}</span>
        </div>
      </MessageContent>
    </Message>
  )
}

function hasAssistantContentAfterLatestUser(messages: AgentChatMessage[]) {
  const latestUserIndex = messages.findLastIndex(
    (message) => message.role === 'user'
  )
  if (latestUserIndex < 0) {
    return false
  }

  return messages.slice(latestUserIndex + 1).some(hasVisibleAssistantContent)
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

/**
 * Shared body for tool parts: renders the input and, once available, either
 * the output or the error. Pulled out so both branches of the header union
 * share the exact same markup.
 */
function ToolBody({ part }: { part: ToolPart }) {
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
