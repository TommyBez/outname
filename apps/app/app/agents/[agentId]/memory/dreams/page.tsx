import { AgentMemoryDreams } from '@outname/shared/agents/components/agent-memory-pages'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent dreaming',
  'Inspect private OUTNA.ME Dream Diary output and DREAMS.md memory.'
)

export default function AgentMemoryDreamsPage({ params }: { params: Params }) {
  return <AgentMemoryDreams params={params} />
}
