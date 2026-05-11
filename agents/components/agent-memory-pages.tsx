import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { RunResultView } from '@/agent-runtime/components/run-result-view'
import { FileChangeReviewButton } from '@/agents/components/file-change-review-button'
import { TriggerButton } from '@/agents/components/trigger-button'
import { requireSession } from '@/auth/server/auth-guard'
import { db } from '@/shared/db'
import { type AgentFileChange, agentFiles } from '@/shared/db/schema'
import {
  getCachedAgentByIdForUser,
  getCachedAgentFileChanges,
  getCachedAgentLogFiles,
  getCachedAgentMemoryFile,
} from '@/shared/server/data'
import { formatDateTime, formatRelative } from '@/shared/server/format'

type Params = Promise<{ agentId: string }>

const LOGS_PREFIX_RE = /^logs\//
const MARKDOWN_EXTENSION_RE = /\.md$/

export function AgentMemoryFiles({ params }: { params: Params }) {
  return (
    <Suspense fallback={<MemoryPageSkeleton />}>
      <ResolvedAgentMemoryFiles params={params} />
    </Suspense>
  )
}

export function AgentMemoryTimeline({ params }: { params: Params }) {
  return (
    <Suspense fallback={<MemoryPageSkeleton />}>
      <ResolvedAgentMemoryTimeline params={params} />
    </Suspense>
  )
}

export function AgentMemoryDreams({ params }: { params: Params }) {
  return (
    <Suspense fallback={<MemoryPageSkeleton />}>
      <ResolvedAgentMemoryDreams params={params} />
    </Suspense>
  )
}

async function ResolvedAgentMemoryFiles({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const rows = await db
    .select()
    .from(agentFiles)
    .where(eq(agentFiles.agentId, agent.id))
    .orderBy(asc(agentFiles.path))

  return (
    <>
      <MemorySectionHeader
        description="Markdown notes the agent maintains inside its persistent sandbox. They are snapshotted to the database at the end of each chat turn, heartbeat, and reflection."
        eyebrow="Memory · Files"
        title="Sandbox files"
      />

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No files yet. The agent will create bootstrap files like{' '}
          <code className="border border-border bg-muted px-1 py-0.5 font-mono text-xs">
            AGENTS.md
          </code>{' '}
          and{' '}
          <code className="border border-border bg-muted px-1 py-0.5 font-mono text-xs">
            IDENTITY.md
          </code>{' '}
          on its first run.
        </p>
      ) : (
        <ul className="flex flex-col gap-10">
          {rows.map((row) => (
            <li className="flex flex-col gap-3" key={row.path}>
              <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-foreground border-b-2 pb-2">
                <h2 className="font-bold font-mono text-sm uppercase tracking-[0.12em]">
                  {row.path}
                </h2>
                <span className="font-mono text-muted-foreground text-xs">
                  Updated {formatRelative(row.updatedAt)}
                </span>
              </header>
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap border-2 border-border bg-muted p-4 font-mono text-xs leading-relaxed">
                {row.content}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

async function ResolvedAgentMemoryTimeline({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const logs = await getCachedAgentLogFiles(agent.id)

  return (
    <>
      <MemorySectionHeader
        description="The agent's markdown event log, mirrored from its system sandbox after each chat, heartbeat, reflection, or sub-agent invocation."
        eyebrow="Memory · Timeline"
        title="Daily logs"
      />

      {logs.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No logs yet. Trigger a heartbeat or reflection to create the first
          daily log.
        </p>
      ) : (
        <ul className="flex flex-col gap-12">
          {logs.map((log) => (
            <li key={log.path}>
              <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-foreground border-b-2 pb-2">
                <h2 className="font-black font-serif text-3xl uppercase leading-none tracking-tighter">
                  {formatLogPath(log.path)}
                </h2>
                <span className="font-mono text-muted-foreground text-xs">
                  Updated {formatRelative(log.updatedAt)}
                </span>
              </header>
              <RunResultView content={log.content} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

async function ResolvedAgentMemoryDreams({ params }: { params: Params }) {
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
      <div className="mb-12 grid gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <MemorySectionHeader
          description="Daily self-review output and reviewable changes proposed to the agent's goals and task list."
          eyebrow="Memory · Reflection"
          title="Reflection stream"
        />
        <div className="flex items-start md:justify-end">
          <TriggerButton
            agentId={agent.id}
            label="Reflect now"
            mode="reflection"
            variant="outline"
          />
        </div>
      </div>

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

function MemorySectionHeader({
  description,
  eyebrow,
  title,
}: {
  description: string
  eyebrow: string
  title: string
}) {
  return (
    <header className="mb-12">
      <p className="swiss-label mb-4 text-accent">{eyebrow}</p>
      <h1 className="font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter md:text-7xl">
        {title}
      </h1>
      <p className="mt-5 max-w-2xl border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </header>
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

function formatLogPath(path: string): string {
  return path.replace(LOGS_PREFIX_RE, '').replace(MARKDOWN_EXTENSION_RE, '')
}

function MemoryPageSkeleton() {
  return (
    <>
      <header className="mb-10 flex flex-col gap-2">
        <div className="h-3 w-32 animate-pulse rounded-sm bg-muted" />
        <div className="h-12 w-80 animate-pulse rounded-sm bg-muted" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded-sm bg-muted" />
      </header>
      <div className="h-64 w-full animate-pulse rounded-sm bg-muted/40" />
    </>
  )
}
