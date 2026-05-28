import { AgentMemoryFiles } from '@/agents/components/agent-memory-pages'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent memory files',
  'Browse private OUTNA.ME agent sandbox memory files.'
)

export default function AgentMemoryFilesPage({ params }: { params: Params }) {
  return <AgentMemoryFiles params={params} />
}
