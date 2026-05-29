import { redirect } from 'next/navigation'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent dreaming',
  'Redirect to private OUTNA.ME agent dreaming memory.'
)

export default async function AgentDreamsRedirect({
  params,
}: {
  params: Params
}) {
  const { agentId } = await params
  redirect(`/agents/${agentId}/memory/dreams`)
}
