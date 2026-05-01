import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AgentForm } from '@/components/agent-form'
import { deleteAgentAction } from '@/lib/agent-actions'
import { readLatestPendingFileWrite } from '@/lib/agent-pending-writes'
import { DEFAULT_MODEL_ID, getAvailableModels } from '@/lib/ai-gateway-models'
import { requireSession } from '@/lib/auth-guard'
import { getCachedAgentByIdForUser, getCachedAgentMemoryFile } from '@/lib/data'

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
  // settings-managed bootstrap content in parallel. The catalog is
  // internally `revalidate: 3600`, so the gateway hit is shared
  // across all visitors. The file prefills come from
  // for operator-authored seeds/corrections. `IDENTITY.md`, `SOUL.md`,
  // and `AGENTS.md` are settings-managed bootstrap files. `USER.md` may
  // also evolve through the agent's own memory tools, so fall back to
  // the mirrored `agent_files` content when no newer settings edit
  // exists.
  const [
    agentRow,
    models,
    identityRow,
    soulRow,
    agentsMdRow,
    userMdRow,
    userMdFile,
  ] = await Promise.all([
    getCachedAgentByIdForUser(agentId, session.user.id),
    getAvailableModels(),
    readLatestPendingFileWrite({ agentId, path: 'IDENTITY.md' }),
    readLatestPendingFileWrite({ agentId, path: 'SOUL.md' }),
    readLatestPendingFileWrite({ agentId, path: 'AGENTS.md' }),
    readLatestPendingFileWrite({ agentId, path: 'USER.md' }),
    getCachedAgentMemoryFile({ agentId, path: 'USER.md' }),
  ])
  if (!agentRow) {
    notFound()
  }
  const userProfile =
    userMdRow && (!userMdFile || userMdRow.enqueuedAt >= userMdFile.updatedAt)
      ? userMdRow.content
      : (userMdFile?.content ?? '')

  async function remove() {
    'use server'
    await deleteAgentAction(agentId)
  }

  return (
    <>
      <Link
        className="mb-8 inline-block font-bold text-muted-foreground text-xs uppercase tracking-[0.18em] transition-colors hover:text-accent"
        href={`/agents/${agentRow.id}`}
      >
        ← {agentRow.name}
      </Link>

      <header className="mb-12 border-foreground border-t-4 pt-6">
        <p className="swiss-label mb-4 text-accent">04. Configure</p>
        <h1 className="max-w-4xl font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter md:text-7xl">
          {agentRow.name}
        </h1>
      </header>

      <section className="border-foreground border-t-2 py-10">
        <AgentForm
          defaultModel={DEFAULT_MODEL_ID}
          initial={{
            id: agentRow.id,
            name: agentRow.name,
            identityCard: identityRow?.content ?? '',
            identity: soulRow?.content ?? '',
            instructions: agentsMdRow?.content ?? '',
            userProfile,
            model: agentRow.model,
            heartbeatEnabled: agentRow.heartbeatEnabled,
            heartbeatIntervalMinutes: agentRow.heartbeatIntervalMinutes,
            reflectionEnabled: agentRow.reflectionEnabled,
            reflectionIntervalMinutes: agentRow.reflectionIntervalMinutes,
          }}
          models={models}
        />
      </section>

      <section className="flex flex-col gap-3 border-destructive border-t-2 pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <p className="font-bold text-destructive text-xs uppercase tracking-[0.2em]">
            Danger zone
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            Deleting this agent removes all of its run history and results.
          </p>
        </div>
        <form action={remove} className="self-start sm:self-auto">
          <button
            className="h-11 border-2 border-destructive px-4 font-bold text-destructive text-xs uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-destructive-foreground"
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
