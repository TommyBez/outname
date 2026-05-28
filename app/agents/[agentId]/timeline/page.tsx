import { redirect } from 'next/navigation'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

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
