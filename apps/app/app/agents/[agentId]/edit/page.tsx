import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { redirect } from 'next/navigation'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent edit',
  'Redirect to private OUTNA.ME agent configuration.'
)

export default async function AgentEditRedirect({
  params,
}: {
  params: Params
}) {
  const { agentId } = await params
  redirect(`/agents/${agentId}/configure`)
}
