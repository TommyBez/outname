import { AgentOverview } from '@/agents/components/agent-overview'

type Params = Promise<{ agentId: string }>

export default function AgentRootPage({ params }: { params: Params }) {
  return <AgentOverview params={params} />
}
