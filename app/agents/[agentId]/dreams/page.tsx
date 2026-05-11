import { redirect } from 'next/navigation'

type Params = Promise<{ agentId: string }>

export default async function AgentDreamsRedirect({
  params,
}: {
  params: Params
}) {
  const { agentId } = await params
  redirect(`/agents/${agentId}/memory/dreams`)
}
