import { redirect } from 'next/navigation'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

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
