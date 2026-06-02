import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { redirect } from 'next/navigation'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent timeline',
  'Redirect to private OUTNA.ME agent memory timeline.'
)

export default async function AgentTimelineRedirect({
  params,
}: {
  params: Params
}) {
  const { agentId } = await params
  redirect(`/agents/${agentId}/memory/timeline`)
}
