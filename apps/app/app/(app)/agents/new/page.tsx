import { requireSession } from '@outname/auth/server/auth-guard'
import { AgentCreationChat } from '@outname/shared/agents/components/agent-creation-chat'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { getUserTimeDisplay } from '@outname/shared/server/user-time-display'
import { Suspense } from 'react'

export const metadata = createPrivatePageMetadata(
  'New agent',
  'Create a new OUTNA.ME agent through a guided chat.'
)

export default function NewAgentPage() {
  return (
    <>
      <header className="mb-8 pt-6">
        <h1 className="max-w-4xl font-semibold text-3xl tracking-tight">
          Create a new agent
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground text-sm leading-relaxed">
          Shape the role, behavior, schedule, memory seeds, and tools in chat.
          The final creation step opens a review panel before anything is saved.
        </p>
      </header>

      <section className="pt-6">
        <Suspense
          fallback={
            <div className="h-[min(720px,calc(100svh-14rem))] min-h-[24rem] border border-border bg-muted" />
          }
        >
          <NewAgentChat />
        </Suspense>
      </section>
    </>
  )
}

async function NewAgentChat() {
  const session = await requireSession()
  const display = await getUserTimeDisplay(session.user.id)
  return <AgentCreationChat timeZone={display.timeZone} />
}
