import { headers } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { createUIMessageStreamResponse, type UIMessage } from "ai"
import { start } from "workflow/api"
import { auth } from "@/lib/auth"
import { getGmailConnection } from "@/lib/google-oauth"
import { getAgentById } from "@/lib/start-agent-run"
import { getAgentRuntime } from "@/lib/agent-runtime-registry"
import { isAgentKind } from "@/workflows/agents/registry"
import {
  ensureConversationForAgent,
  insertChatMessage,
} from "@/lib/agent-chat"
import { agentChat } from "@/workflows/chat/workflow"
import type { ChatRole } from "@/lib/db/schema"

/**
 * POST /api/agents/[agentId]/chat
 *
 * Single-turn chat endpoint. The client sends the full UIMessage history
 * (see `workflow-chat-transport`'s default shape). We:
 *
 *   1. Authenticate and authorize against the agent's owner.
 *   2. Verify the kind has a chat agent registered (future-proofing for
 *      chat-only or cron-only kinds).
 *   3. Resolve or create the single conversation for this agent.
 *   4. Persist the just-sent user message so the history row survives
 *      even if the workflow fails mid-stream.
 *   5. Start `agentChat` and pipe its readable through the AI SDK's
 *      `createUIMessageStreamResponse` so `useChat` can consume the
 *      stream end-to-end.
 *
 * The workflow itself persists the assistant turn after streaming
 * completes — see `workflows/chat/steps/persist-assistant-turn.ts`.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { agentId } = await params
  const agent = await getAgentById(agentId)
  if (!agent || agent.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  if (!isAgentKind(agent.kind)) {
    return NextResponse.json({ error: "unknown agent kind" }, { status: 400 })
  }

  const runtime = getAgentRuntime(agent.kind)
  if (!runtime?.buildAgent) {
    return NextResponse.json(
      { error: `Agent kind "${agent.kind}" does not support chat.` },
      { status: 400 },
    )
  }

  // Kind-specific pre-flight. For now the only kind that needs any is
  // daily-email-brief → Gmail OAuth. Mirrors the gate in the trigger route.
  if (agent.kind === "daily-email-brief") {
    const conn = await getGmailConnection()
    if (!conn) {
      return NextResponse.json(
        {
          error:
            "Gmail is not connected. Go to /settings and click Connect Gmail.",
        },
        { status: 412 },
      )
    }
    if (conn.status !== "active") {
      return NextResponse.json(
        { error: `Gmail connection is ${conn.status}. Reconnect it in /settings.` },
        { status: 412 },
      )
    }
  }

  let body: { messages?: UIMessage[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const uiMessages = body.messages ?? []
  if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 })
  }

  const conversationId = await ensureConversationForAgent(agentId)

  // Persist the newest user message up-front. Doing this before the
  // workflow starts means a mid-stream failure still leaves the user's
  // question in the transcript so they can see it and retry.
  const last = uiMessages[uiMessages.length - 1]
  if (last && last.role === "user") {
    await insertChatMessage({
      conversationId,
      id: last.id,
      role: last.role as ChatRole,
      parts: last.parts,
      metadata: last.metadata,
    })
  }

  const run = await start(agentChat, [
    {
      kind: agent.kind,
      agentId,
      conversationId,
      uiMessages,
    },
  ])

  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: {
      "x-workflow-run-id": run.runId,
    },
  })
}
