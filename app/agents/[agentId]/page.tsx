import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/auth/server/auth-guard'
import { getCachedAgentByIdForUser } from '@/shared/server/data'

type Params = Promise<{ agentId: string }>

/**
 * Agent landing. In Phase 2 every agent is a generic chat agent, so
 * this route always redirects to the chat workspace (which in turn
 * resolves to the latest conversation or `/chat/new`). The overview
 * surface lives at `/agents/:id/about` for runs/history/configuration.
 *
 * The redirect work is wrapped in `<Suspense>` so Cache Components is
 * happy: `requireSession()` is uncached and would otherwise block the
 * shell from streaming. Users never see the fallback because either
 * the redirect or `notFound()` resolves before any UI paints.
 */
export default function AgentRootPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <RedirectToChat params={params} />
    </Suspense>
  )
}

async function RedirectToChat({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agentRow = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agentRow) {
    notFound()
  }
  redirect(`/agents/${agentRow.id}/chat`)
  // Unreachable; satisfies the JSX return contract.
  return null
}
