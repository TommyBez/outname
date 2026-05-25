import { Suspense } from 'react'
import {
  AgentWorkspaceFrame,
  AgentWorkspaceSkeleton,
} from '@/agents/components/agent-workspace'
import { requireSession } from '@/auth/server/auth-guard'
import {
  AgentSidebarSection,
  AgentSidebarSectionSkeleton,
} from '@/chat/components/agent-sidebar-section'
import { AiGatewayKeyGateProvider } from '@/shared/components/ai-gateway-key-gate/ai-gateway-key-gate-provider'
import { AppShell } from '@/shared/components/layout/app-shell'
import { hasUserAiGatewayApiKey } from '@/shared/server/ai-gateway-byok'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent workspace',
  'Chat, memory, tools, and configuration for a private OUTNA.ME agent.'
)

export default function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Params
}) {
  return (
    <AppShell
      sidebarExtras={
        <Suspense fallback={<AgentSidebarSectionSkeleton />}>
          <AgentSidebarSection params={params} />
        </Suspense>
      }
    >
      <Suspense fallback={<AgentWorkspaceSkeleton />}>
        <GatedAgentWorkspace params={params}>{children}</GatedAgentWorkspace>
      </Suspense>
    </AppShell>
  )
}

async function GatedAgentWorkspace({
  children,
  params,
}: {
  children: React.ReactNode
  params: Params
}) {
  const session = await requireSession()
  const hasKey = await hasUserAiGatewayApiKey(session.user.id)

  return (
    <AiGatewayKeyGateProvider initialHasKey={hasKey}>
      <AgentWorkspaceFrame params={params}>{children}</AgentWorkspaceFrame>
    </AiGatewayKeyGateProvider>
  )
}
