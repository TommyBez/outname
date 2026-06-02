import {
  AgentSidebarSection,
  AgentSidebarSectionSkeleton,
} from '@outname/ai/chat/components/agent-sidebar-section'
import {
  AgentWorkspaceFrame,
  AgentWorkspaceSkeleton,
} from '@outname/shared/agents/components/agent-workspace'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { AppShell } from '@outname/ui/components/layout/app-shell'
import { Suspense } from 'react'

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
  const sidebarExtras = (
    <Suspense fallback={<AgentSidebarSectionSkeleton />}>
      <AgentSidebarSection params={params} />
    </Suspense>
  )

  return (
    <AppShell sidebarExtras={sidebarExtras}>
      <Suspense fallback={<AgentWorkspaceSkeleton />}>
        <AgentWorkspaceFrame params={params}>{children}</AgentWorkspaceFrame>
      </Suspense>
    </AppShell>
  )
}
