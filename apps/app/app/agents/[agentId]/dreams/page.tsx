import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { redirect } from 'next/navigation'

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
