import { Suspense } from "react"
import { AppShell } from "@/components/app-shell"
import {
  AgentSidebarSection,
  AgentSidebarSectionSkeleton,
} from "@/components/agent-sidebar-section"

type Params = Promise<{ agentId: string }>

/**
 * Shell for every agent route. Supplies the single app shell plus a
 * contextual "agent workspace" section in the sidebar, so Chat, About,
 * and Configure all share the same chrome without spawning a second
 * sidebar or a tab strip above the page content.
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
      {children}
    </AppShell>
  )
}
