"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool"
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning"

interface AgentChatProps {
  agentId: string
  /** Stable id for the conversation this chat targets. For draft chats
   * this is a server-generated candidate id that will only be persisted
   * on the first user message; for existing conversations it's the real
   * row id. */
  conversationId: string
  initialMessages: UIMessage[]
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
  const router = useRouter()
  const [input, setInput] = useState("")
  const didPromoteDraftRef = useRef(false)
  console.log("[v0] AgentChat render", {
    conversationId,
    isDraft,
    initialMessagesCount: initialMessages.length,
    initialRoles: initialMessages.map((m) => m.role),
    initialIds: initialMessages.map((m) => m.id),
    initialPartsCounts: initialMessages.map((m) => m.parts?.length ?? 0),
  })
  const { messages, sendMessage, status, error, stop } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `/api/agents/${agentId}/chat`,
      body: { conversationId },
    }),
    onFinish: () => {
      // Surface the freshly generated title (and any sidebar reordering)
      // once the assistant turn finishes. Cheap no-op for non-first turns.
      router.refresh()
    },
  })
  console.log("[v0] AgentChat useChat messages", {
    conversationId,
    status,
    count: messages.length,
    roles: messages.map((m) => m.role),
    ids: messages.map((m) => m.id),
  })

  // Draft → persisted URL swap. We do this in `history.replaceState`
  // instead of `router.replace` because the latter would unmount the
  // streaming `useChat` instance and strand the in-flight turn. Running
  // this effect the moment a message exists (before the assistant even
  // finishes) keeps the address bar honest during the first turn.
  useEffect(() => {
    if (!isDraft) return
    if (didPromoteDraftRef.current) return
    if (messages.length === 0) return
    didPromoteDraftRef.current = true
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        `/agents/${agentId}/chat/${conversationId}`,
      )
    }
  }, [agentId, conversationId, isDraft, messages.length])

  const isBusy = status === "submitted" || status === "streaming"

  // PromptInput's onSubmit contract: AI Elements gathers files + the
  // textarea text and hands us a structured `PromptInputMessage`.
  // The raw FormEvent is the second argument and we do NOT need to call
  // preventDefault on it — the component already does.
  function handleSubmit(message: PromptInputMessage) {
    const text = (message.text ?? "").trim()
    if (!text || isBusy) return
    sendMessage({ text })
    setInput("")
  }

  return (
    <div className="flex h-[min(70vh,720px)] flex-col">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Ask this agent anything — it has the same tools the scheduled run does."
            />
          ) : (
            messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && (
        <p
          role="alert"
          className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive"
        >
          {error.message || "Something went wrong. Try again."}
        </p>
      )}

      <PromptInput onSubmit={handleSubmit} className="mt-4">
        <PromptInputTextarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about your inbox…"
          disabled={isBusy}
        />
        <PromptInputFooter>
          <div />
          <PromptInputSubmit
            status={status}
            onStop={stop}
            disabled={!isBusy && input.trim().length === 0}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

function ChatMessage({ message }: { message: UIMessage }) {
  return (
    <Message from={message.role === "user" ? "user" : "assistant"}>
      <MessageContent>
        {message.parts.map((part, index) => {
          const key = `${message.id}-${index}`

          if (part.type === "text") {
            return <MessageResponse key={key}>{part.text}</MessageResponse>
          }

          if (part.type === "reasoning") {
            return (
              <Reasoning
                key={key}
                isStreaming={part.state === "streaming"}
                className="-mx-2"
              >
                <ReasoningTrigger />
                <ReasoningContent>{part.text}</ReasoningContent>
              </Reasoning>
            )
          }

          // Tool parts: `tool-*` (static) and `dynamic-tool` both satisfy ToolPart.
          // ToolHeader takes a discriminated union on `type` so we branch.
          if (part.type === "dynamic-tool") {
            const toolPart = part as ToolPart
            return (
              <Tool key={key} className="-mx-2">
                <ToolHeader
                  type="dynamic-tool"
                  state={toolPart.state}
                  toolName={
                    // `DynamicToolUIPart` exposes the runtime tool name.
                    (toolPart as { toolName: string }).toolName
                  }
                />
                <ToolBody part={toolPart} />
              </Tool>
            )
          }

          if (typeof part.type === "string" && part.type.startsWith("tool-")) {
            const toolPart = part as ToolPart
            return (
              <Tool key={key} className="-mx-2">
                <ToolHeader
                  type={toolPart.type as Exclude<ToolPart["type"], "dynamic-tool">}
                  state={toolPart.state}
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

/**
 * Shared body for tool parts: renders the input and, once available, either
 * the output or the error. Pulled out so both branches of the header union
 * share the exact same markup.
 */
function ToolBody({ part }: { part: ToolPart }) {
  return (
    <ToolContent>
      <ToolInput input={part.input} />
      {part.state === "output-available" && (
        <ToolOutput output={part.output} errorText={undefined} />
      )}
      {part.state === "output-error" && (
        <ToolOutput output={undefined} errorText={part.errorText} />
      )}
    </ToolContent>
  )
}
