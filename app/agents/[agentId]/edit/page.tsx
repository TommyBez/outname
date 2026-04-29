import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AgentForm } from '@/components/agent-form'
import { deleteAgentAction } from '@/lib/agent-actions'
import { readLatestPendingFileWrite } from '@/lib/agent-pending-writes'
import { DEFAULT_MODEL_ID, getAvailableModels } from '@/lib/ai-gateway-models'
import { requireSession } from '@/lib/auth-guard'
import { getCachedAgentByIdForUser } from '@/lib/data'

type Params = Promise<{ agentId: string }>

/**
 * Agent configuration form. The outer shell (sidebar + top bar) comes
 * from `app/agents/[agentId]/layout.tsx`, so this page only owns its
 * own content tree + Suspense boundary.
 */
export default function AgentEditPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<EditSkeleton />}>
      <AgentEdit params={params} />
    </Suspense>
  )
}

async function AgentEdit({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()

  // Fetch the agent + the AI Gateway model catalog + the most recent
  // user-authored persona content in parallel. The catalog is
  // internally `revalidate: 3600`, so the gateway hit is shared
  // across all visitors. The persona prefills come from
  // `pending_file_writes` — that table is the UI's source of truth
  // for "what is effectively on disk" because the seed step writes
  // platform defaults and only the UI mutates these files
  // afterwards (the agent's memory_* tools refuse persona paths).
  const [agentRow, models, soulRow, agentsMdRow] = await Promise.all([
    getCachedAgentByIdForUser(agentId, session.user.id),
    getAvailableModels(),
    readLatestPendingFileWrite({ agentId, path: 'SOUL.md' }),
    readLatestPendingFileWrite({ agentId, path: 'AGENTS.md' }),
  ])
  if (!agentRow) {
    notFound()
  }

  async function remove() {
    'use server'
    await deleteAgentAction(agentId)
  }

  return (
    <>
      <Link
        className="mb-6 inline-block font-mono text-muted-foreground text-xs uppercase tracking-[0.2em] transition-colors hover:text-foreground"
        href={`/agents/${agentRow.id}`}
      >
        ← {agentRow.name}
      </Link>

      <header className="mb-10 flex flex-col gap-2">
        <p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">
          Configure
        </p>
        <h1 className="font-medium font-serif text-4xl leading-tight tracking-tight md:text-5xl">
          {agentRow.name}
        </h1>
      </header>

      <section className="border-border border-t py-10">
        <AgentForm
          defaultModel={DEFAULT_MODEL_ID}
          initial={{
            id: agentRow.id,
            name: agentRow.name,
            identity: soulRow?.content ?? '',
            instructions: agentsMdRow?.content ?? '',
            model: agentRow.model,
            heartbeatEnabled: agentRow.heartbeatEnabled,
            heartbeatIntervalMinutes: agentRow.heartbeatIntervalMinutes,
          }}
          models={models}
        />
      </section>

      <section className="flex flex-col gap-3 border-destructive/30 border-t pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <p className="font-mono text-destructive text-xs uppercase tracking-[0.2em]">
            Danger zone
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            Deleting this agent removes all of its run history and results.
          </p>
        </div>
        <form action={remove} className="self-start sm:self-auto">
          <button
            className="rounded-md border border-destructive/50 px-3 py-1.5 text-destructive text-sm transition-colors hover:bg-destructive hover:text-background"
            type="submit"
          >
            Delete agent
          </button>
        </form>
      </section>
    </>
  )
}

function EditSkeleton() {
  return (
    <>
      <div className="mb-6 h-3 w-28 animate-pulse rounded-sm bg-muted" />
      <div className="mb-10 flex flex-col gap-2">
        <div className="h-3 w-20 animate-pulse rounded-sm bg-muted" />
        <div className="h-10 w-64 animate-pulse rounded-sm bg-muted" />
      </div>
      <div className="border-border border-t py-10">
        <div className="h-64 w-full animate-pulse rounded-sm bg-muted" />
      </div>
    </>
  )
}
