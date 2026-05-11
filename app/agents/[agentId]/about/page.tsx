import { redirect } from 'next/navigation'

type Params = Promise<{ agentId: string }>

export default async function AgentAboutRedirect({
  params,
}: {
  params: Params
}) {
  const { agentId } = await params
  redirect(`/agents/${agentId}`)
}
