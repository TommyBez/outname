import { requireSession } from '@outname/auth/server/auth-guard'
import { getCachedAgentByIdForUser } from '@outname/shared/server/data'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent memory',
  'Inspect private OUTNA.ME agent files, timelines, and dreaming output.'
)

export default function AgentMemoryPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<MemoryHubSkeleton />}>
      <ResolvedAgentMemoryPage params={params} />
    </Suspense>
  )
}

async function ResolvedAgentMemoryPage({ params }: { params: Params }) {
  const [{ agentId }, session] = await Promise.all([params, requireSession()])
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  return (
    <>
      <header className="mb-12">
        <p className="swiss-label mb-4 text-brand">Memory</p>
        <h1 className="font-semibold text-3xl tracking-tight">Agent memory</h1>
        <p className="mt-5 max-w-2xl text-muted-foreground text-sm leading-relaxed">
          Inspect sandbox files, daily logs, and dreaming output for this agent.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <MemoryCard
          description="Common markdown files read from the persistent system sandbox, with Redis as a cache."
          href={`/agents/${agent.id}/memory/files`}
          title="Files"
        />
        <MemoryCard
          description="Daily event logs from chat, heartbeat, dreaming, and sub-agent runs."
          href={`/agents/${agent.id}/memory/timeline`}
          title="Timeline"
        />
        <MemoryCard
          description="DREAMS.md and the latest dreaming output captured for this agent."
          href={`/agents/${agent.id}/memory/dreams`}
          title="Dreaming"
        />
      </div>
    </>
  )
}

function MemoryCard({
  description,
  href,
  title,
}: {
  description: string
  href: string
  title: string
}) {
  return (
    <Link
      className="group flex min-h-40 flex-col justify-between border border-border p-5 transition-colors hover:bg-accent"
      href={href}
    >
      <p className="font-semibold font-serif text-2xl leading-none tracking-tighter">
        {title}
      </p>
      <p className="mt-6 text-muted-foreground text-sm leading-relaxed group-hover:text-foreground">
        {description}
      </p>
    </Link>
  )
}

function MemoryHubSkeleton() {
  return (
    <>
      <div className="h-12 w-80 animate-pulse bg-muted" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div className="h-40 animate-pulse bg-muted" key={index} />
        ))}
      </div>
    </>
  )
}
