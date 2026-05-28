import { redirect } from 'next/navigation'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

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
