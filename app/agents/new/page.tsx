import { Suspense } from 'react'
import { AgentCreationChat } from '@/agents/components/agent-creation-chat'
import { AgentCreationGate } from '@/agents/components/agent-creation-gate'
import { getAgentCreationLimitState } from '@/agents/server/agent-limit'
import { requireSession } from '@/auth/server/auth-guard'
import { AppShell } from '@/shared/components/layout/app-shell'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'
import { getUserTimeDisplay } from '@/shared/server/user-time-display'

export const metadata = createPrivatePageMetadata(
  'New agent',
  'Create a new OUTNA.ME agent through a guided chat.'
)

export default function NewAgentPage() {
  return (
    <AppShell>
      <header className="mb-8 border-foreground border-t-4 pt-6">
        <p className="swiss-label mb-4 text-accent">03. New agent</p>
        <h1 className="max-w-4xl font-black font-serif text-4xl uppercase leading-[0.9] tracking-tighter sm:text-5xl lg:text-6xl xl:text-7xl">
          Create a new agent
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground text-sm leading-relaxed">
          Shape the role, behavior, schedule, memory seeds, and tools in chat.
          The final creation step opens a review panel before anything is saved.
        </p>
      </header>

      <section className="border-foreground border-t-2 pt-6">
        <Suspense
          fallback={
            <div className="h-[min(720px,calc(100svh-14rem))] min-h-[24rem] border-2 border-foreground bg-muted" />
          }
        >
          <NewAgentChat />
        </Suspense>
      </section>
    </AppShell>
  )
}

async function NewAgentChat() {
  const session = await requireSession()
  const [display, limitState] = await Promise.all([
    getUserTimeDisplay(session.user.id),
    getAgentCreationLimitState(session.user.id),
  ])
  return (
    <AgentCreationGate limitState={limitState}>
      <AgentCreationChat limitState={limitState} timeZone={display.timeZone} />
    </AgentCreationGate>
  )
}
