import { AgentMemoryDreams } from '@/agents/components/agent-memory-pages'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent dreaming',
  'Inspect private OUTNA.ME agent dreaming output and DREAMS.md memory.'
)

export default function AgentMemoryDreamsPage({ params }: { params: Params }) {
  return <AgentMemoryDreams params={params} />
}
