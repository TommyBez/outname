import { AgentMemoryTimeline } from '@/agents/components/agent-memory-pages'

type Params = Promise<{ agentId: string }>

export default function AgentMemoryTimelinePage({
  params,
}: {
  params: Params
}) {
  return <AgentMemoryTimeline params={params} />
}
