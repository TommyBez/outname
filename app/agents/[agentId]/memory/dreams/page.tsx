import { AgentMemoryDreams } from '@/agents/components/agent-memory-pages'

type Params = Promise<{ agentId: string }>

export default function AgentMemoryDreamsPage({ params }: { params: Params }) {
  return <AgentMemoryDreams params={params} />
}
