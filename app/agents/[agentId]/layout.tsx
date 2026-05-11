import { Suspense } from 'react'
import {
  AgentWorkspaceFrame,
  AgentWorkspaceSkeleton,
} from '@/agents/components/agent-workspace'
import {
  AgentSidebarSection,
  AgentSidebarSectionSkeleton,
} from '@/chat/components/agent-sidebar-section'
import { AppShell } from '@/shared/components/layout/app-shell'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent workspace',
  'Chat, memory, tools, and configuration for a private OUTNA.ME agent.'
)

/**
 * Shell for every agent route. Supplies the single app shell plus a
 * contextual chat-history section in the sidebar, so Overview, Chat,
 * Configure, Tools, and Memory share the same workspace chrome.
 *
 * The sidebar section is streamed through its own `<Suspense>` so the
 * rest of the shell (and the page content below) paint immediately even
 * while the agent row is being fetched.
 */
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
        <AgentWorkspaceFrame params={params}>{children}</AgentWorkspaceFrame>
      </Suspense>
    </AppShell>
  )
}
