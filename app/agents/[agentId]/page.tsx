import { AgentOverview } from '@/agents/components/agent-overview'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent overview',
  'Review private OUTNA.ME agent status, memory, and recent work.'
)

export default function AgentRootPage({ params }: { params: Params }) {
  return <AgentOverview params={params} />
}
