"use client"

import { useState } from "react"
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
  PromptInputToolbar,
  PromptInputSubmit,
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
  initialMessages: UIMessage[]
}

/**
 * Client-side chat surface. Owns the `useChat` transport, the draft input,
 * and per-part rendering of assistant turns (text, tool calls, reasoning).
 *
 * The transport targets a per-agent endpoint (`/api/agents/:id/chat`) so
 * server-side identity is derived from the session, not the request body.
 */
export function AgentChat({ agentId, initialMessages }: AgentChatProps) {
  const [input, setInput] = useState("")
  const { messages, sendMessage, status, error, stop } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `/api/agents/${agentId}/chat`,
    }),
  })

  const isBusy = status === "submitted" || status === "streaming"

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = input.trim()
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
        <PromptInputToolbar>
          <div />
          <PromptInputSubmit
            status={isBusy ? "streaming" : undefined}
            onClick={(event) => {
              if (isBusy) {
                event.preventDefault()
                stop()
              }
            }}
            disabled={!isBusy && input.trim().length === 0}
          />
        </PromptInputToolbar>
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
          if (
            part.type === "dynamic-tool" ||
            (typeof part.type === "string" && part.type.startsWith("tool-"))
          ) {
            const toolPart = part as ToolPart
            return (
              <Tool key={key} className="-mx-2">
                <ToolHeader
                  type={toolPart.type}
                  state={toolPart.state}
                />
                <ToolContent>
                  <ToolInput input={toolPart.input} />
                  {toolPart.state === "output-available" && (
                    <ToolOutput
                      output={toolPart.output}
                      errorText={undefined}
                    />
                  )}
                  {toolPart.state === "output-error" && (
                    <ToolOutput
                      output={undefined}
                      errorText={toolPart.errorText}
                    />
                  )}
                </ToolContent>
              </Tool>
            )
          }

          return null
        })}
      </MessageContent>
    </Message>
  )
}
