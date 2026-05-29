import { AgentMemoryTimeline } from '@outname/shared/agents/components/agent-memory-pages'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent memory timeline',
  'Review private OUTNA.ME agent memory and event timeline entries.'
)

export default function AgentMemoryTimelinePage({
  params,
}: {
  params: Params
}) {
  return <AgentMemoryTimeline params={params} />
}
