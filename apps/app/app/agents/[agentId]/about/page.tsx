import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { redirect } from 'next/navigation'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent about',
  'Redirect to private OUTNA.ME agent overview.'
)

export default async function AgentAboutRedirect({
  params,
}: {
  params: Params
}) {
  const { agentId } = await params
  redirect(`/agents/${agentId}`)
}
