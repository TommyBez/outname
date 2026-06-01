import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { redirect } from 'next/navigation'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent files',
  'Redirect to private OUTNA.ME agent memory files.'
)

export default async function AgentFilesRedirect({
  params,
}: {
  params: Params
}) {
  const { agentId } = await params
  redirect(`/agents/${agentId}/memory/files`)
}
