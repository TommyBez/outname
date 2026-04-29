import { AgentOverview } from '@/components/agent-overview'

type Params = Promise<{ agentId: string }>

/**
 * "About this agent" — the demoted overview surface, reached from the
 * chat header's kebab menu. Renders the same content the non-chat root
 * page shows so there's one canonical overview component.
 */
export default function AgentAboutPage({ params }: { params: Params }) {
  return <AgentOverview params={params} />
}
