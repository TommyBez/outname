import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { RunResultView } from '@/agent-runtime/components/run-result-view'
import { FileChangeReviewButton } from '@/agents/components/file-change-review-button'
import { TriggerButton } from '@/agents/components/trigger-button'
import { requireSession } from '@/auth/server/auth-guard'
import type { AgentFileChange } from '@/shared/db/schema'
import {
  getCachedAgentByIdForUser,
  getCachedAgentFileChanges,
  getCachedAgentMemoryFile,
} from '@/shared/server/data'
import { formatDateTime } from '@/shared/server/format'

type Params = Promise<{ agentId: string }>

export default function AgentDreamsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<DreamsSkeleton />}>
      <ResolvedAgentDreams params={params} />
    </Suspense>
  )
}

async function ResolvedAgentDreams({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const [dreams, goalsChanges, taskChanges] = await Promise.all([
    getCachedAgentMemoryFile({ agentId: agent.id, path: 'DREAMS.md' }),
    getCachedAgentFileChanges({
      agentId: agent.id,
      limit: 10,
      path: 'GOALS.md',
    }),
    getCachedAgentFileChanges({
      agentId: agent.id,
      limit: 10,
      path: 'TASKS.md',
    }),
  ])
  const reviewChanges = [...goalsChanges, ...taskChanges].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )

  return (
    <>
      <header className="mb-12 border-foreground border-t-4 pt-6">
        <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_auto]">
          <div>
            <p className="swiss-label mb-4 text-accent">
              {agent.name} · DREAMS
            </p>
            <h1 className="font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter md:text-7xl">
              Reflection stream
            </h1>
            <p className="mt-5 max-w-2xl border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
              Daily self-review output and reviewable changes proposed to the
              agent&apos;s goals and task list.
            </p>
          </div>
          <div className="flex items-start md:justify-end">
            <TriggerButton
              agentId={agent.id}
              label="Reflect now"
              mode="reflection"
              variant="outline"
            />
          </div>
        </div>
      </header>

      <section className="mb-14">
        <h2 className="swiss-label mb-6 text-accent">01. DREAMS.md</h2>
        <RunResultView content={dreams?.content ?? null} />
      </section>

      <section className="border-foreground border-t-2 pt-8">
        <h2 className="swiss-label mb-6 text-accent">02. Review diffs</h2>
        {reviewChanges.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No GOALS.md or TASKS.md changes have been captured yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-8">
            {reviewChanges.map((change) => (
              <li key={change.id}>
                <FileChangeCard change={change} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function FileChangeCard({ change }: { change: AgentFileChange }) {
  return (
    <article className="border-2 border-foreground">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-foreground border-b-2 p-4">
        <div>
          <p className="font-bold font-mono text-sm uppercase tracking-[0.12em]">
            {change.path}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            {change.sourceType} · {formatDateTime(change.createdAt)}
          </p>
        </div>
        <FileChangeReviewButton
          changeId={change.id}
          reviewed={Boolean(change.reviewedAt)}
        />
      </header>
      <div className="grid md:grid-cols-2">
        <DiffPane label="Before" value={change.beforeContent} />
        <DiffPane label="After" value={change.afterContent} />
      </div>
    </article>
  )
}

function DiffPane({ label, value }: { label: string; value: string | null }) {
  return (
    <section className="border-foreground border-b-2 p-4 last:border-b-0 md:border-r-2 md:border-b-0 md:last:border-r-0">
      <h3 className="mb-3 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
        {label}
      </h3>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap bg-muted p-3 font-mono text-xs leading-relaxed">
        {value ?? '(missing)'}
      </pre>
    </section>
  )
}

function DreamsSkeleton() {
  return (
    <>
      <header className="mb-10 flex flex-col gap-2">
        <div className="h-3 w-32 animate-pulse rounded-sm bg-muted" />
        <div className="h-12 w-96 animate-pulse rounded-sm bg-muted" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded-sm bg-muted" />
      </header>
      <div className="h-64 w-full animate-pulse rounded-sm bg-muted/40" />
    </>
  )
}
