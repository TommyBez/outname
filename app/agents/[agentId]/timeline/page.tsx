import { redirect } from 'next/navigation'

type Params = Promise<{ agentId: string }>

export default async function AgentTimelineRedirect({
  params,
}: {
  params: Params
}) {
  const { agentId } = await params
  redirect(`/agents/${agentId}/memory/timeline`)
}
