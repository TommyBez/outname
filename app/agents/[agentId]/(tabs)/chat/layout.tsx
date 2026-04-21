import { Suspense } from "react"
import { notFound } from "next/navigation"
import { requireSession } from "@/lib/auth-guard"
import { getAgentByIdForUser } from "@/lib/data"
import { listConversationsForAgent } from "@/lib/agent-chat"
import { ChatSessionsSidebar } from "@/components/chat-sessions-sidebar"

type Params = Promise<{ agentId: string }>

/**
 * Two-column shell for every chat route: conversation list on the left,
 * active pane on the right. Lives inside the agent `(tabs)` group so the
 * header + tab strip from the parent layout continue to frame the view.
 *
 * The sidebar is a server-rendered snapshot of the current list. On
 * navigation to `/chat/[conversationId]` the layout re-renders with a
 * fresh list, and `router.refresh()` calls from the client (after a new
 * turn completes, or after a rename) keep it in sync without client
 * fetching.
 */
export default function ChatLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Params
}) {
  return (
    <div className="grid min-h-[min(70vh,720px)] grid-cols-1 gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
      <Suspense fallback={<SidebarSkeleton />}>
        <ChatSidebarContainer params={params} />
      </Suspense>
      <main className="min-w-0">{children}</main>
    </div>
  )
}

async function ChatSidebarContainer({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) notFound()

  const conversations = await listConversationsForAgent(agent.id)

  return (
    <ChatSessionsSidebar
      agentId={agent.id}
      conversations={conversations.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt.toISOString(),
      }))}
    />
  )
}

function SidebarSkeleton() {
  return (
    <aside className="hidden md:block">
      <div className="mb-3 h-9 w-full animate-pulse rounded-md bg-muted" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-12 w-full animate-pulse rounded-md bg-muted"
          />
        ))}
      </div>
    </aside>
  )
}
