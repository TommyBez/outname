import { AgentMemoryFiles } from '@/agents/components/agent-memory-pages'

type Params = Promise<{ agentId: string }>

export default function AgentMemoryFilesPage({ params }: { params: Params }) {
  return <AgentMemoryFiles params={params} />
}
