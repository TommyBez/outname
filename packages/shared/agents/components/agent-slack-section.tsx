import { hasSlackIntegrationAccess } from '@outname/auth/server/auth-guard'
import { SlackBindingsPanel } from '@outname/shared/channels/slack/components/slack-bindings-panel'
import { listSlackBindingsForAgent } from '@outname/shared/channels/slack/server/bindings-query'

export async function AgentSlackSection({
  agentId,
  userId,
}: {
  agentId: string
  userId: string
}) {
  const isAvailable = await hasSlackIntegrationAccess(userId)
  const { bindings, installations } = isAvailable
    ? await listSlackBindingsForAgent(agentId, userId)
    : { bindings: [], installations: [] }
  const isConfigured = Boolean(
    process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET
  )
  return (
    <SlackBindingsPanel
      agentId={agentId}
      bindings={bindings}
      installations={installations}
      isAvailable={isAvailable}
      isConfigured={isConfigured}
    />
  )
}
