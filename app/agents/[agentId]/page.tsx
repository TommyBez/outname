import { Suspense } from "react"
import { notFound, redirect } from "next/navigation"
import { requireSession } from "@/lib/auth-guard"
import { getCachedAgentByIdForUser } from "@/lib/data"
import { getAgentRuntime } from "@/lib/agent-runtime-registry"
import { AgentOverview } from "@/components/agent-overview"
import type { AgentKind } from "@/lib/db/schema"

type Params = Promise<{ agentId: string }>

/**
 * Agent landing. Chat-capable agents redirect to their chat workspace
 * (which in turn resolves to the latest conversation or `/chat/new`);
 * other kinds render the overview inline.
 *
 * The capability check is identical to the one used by the chat layout
 * and the sidebar workspace: `Boolean(getAgentRuntime(kind)?.buildAgent)`.
 */
export default function AgentRootPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<ResolveFallback />}>
      <ResolveAgentRoot params={params} />
    </Suspense>
  )
}

async function ResolveAgentRoot({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) notFound()

  const runtime = getAgentRuntime(agent.kind as AgentKind)
  if (runtime?.buildAgent) {
    redirect(`/agents/${agent.id}/chat`)
  }

  return <AgentOverview params={params} />
}

function ResolveFallback() {
  // Matches the overview skeleton's top spacing so non-chat kinds don't
  // flash a layout shift as they resolve.
  return (
    <div className="flex flex-col gap-6">
      <div className="h-10 w-64 animate-pulse rounded-sm bg-muted" />
      <div className="h-48 w-full animate-pulse rounded-sm bg-muted" />
    </div>
  )
}
