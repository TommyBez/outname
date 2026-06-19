import { RunResultView } from '@outname/ai/agent-runtime/components/run-result-view'
import { requireSession } from '@outname/auth/server/auth-guard'
import { AgentMemoryFilesList } from '@outname/shared/agents/components/agent-memory-files-list'
import { TriggerButton } from '@outname/shared/agents/components/trigger-button'
import {
  getCachedAgentByIdForUser,
  getCachedAgentLogFiles,
  getCachedAgentMemoryFile,
  getCachedAgentMemoryFiles,
} from '@outname/shared/server/data'
import { getUserTimeDisplay } from '@outname/shared/server/user-time-display'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

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
  const [{ agentId }, session] = await Promise.all([params, requireSession()])
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const [rows, display] = await Promise.all([
    getCachedAgentMemoryFiles(agent.id),
    getUserTimeDisplay(session.user.id),
  ])

  return (
    <>
      <MemorySectionHeader
        description="Markdown notes the agent maintains inside its persistent sandbox. The sandbox is the source of truth; Redis is only a fast cache for this view."
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
        <AgentMemoryFilesList
          files={rows.map((row) => ({
            content: row.content,
            path: row.path,
            updatedLabel: display.relative(row.updatedAt),
          }))}
        />
      )}
    </>
  )
}

async function ResolvedAgentMemoryTimeline({ params }: { params: Params }) {
  const [{ agentId }, session] = await Promise.all([params, requireSession()])
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const [logs, display] = await Promise.all([
    getCachedAgentLogFiles(agent.id),
    getUserTimeDisplay(session.user.id),
  ])

  return (
    <>
      <MemorySectionHeader
        description="The agent's markdown event log from its persistent system sandbox."
        eyebrow="Memory · Timeline"
        title="Daily logs"
      />

      {logs.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No logs yet. Trigger a heartbeat or dream run to create the first
          daily log.
        </p>
      ) : (
        <ul className="flex flex-col gap-12">
          {logs.map((log) => (
            <li key={log.path}>
              <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-border border-b pb-2">
                <h2 className="font-semibold text-xl tracking-tight">
                  {formatLogPath(log.path)}
                </h2>
                <span className="font-mono text-muted-foreground text-xs">
                  Updated {display.relative(log.updatedAt)}
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
  const [{ agentId }, session] = await Promise.all([params, requireSession()])
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const dreams = await getCachedAgentMemoryFile({
    agentId: agent.id,
    path: 'DREAMS.md',
  })

  return (
    <>
      <div className="mb-12 grid gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <MemorySectionHeader
          description="Daily self-review output captured in the agent's dreaming log."
          eyebrow="Memory · Dreaming"
          title="Dreaming stream"
        />
        <div className="flex items-start md:justify-end">
          <TriggerButton
            agentId={agent.id}
            label="Dream now"
            mode="dreaming"
            variant="outline"
          />
        </div>
      </div>

      <section>
        <h2 className="swiss-label mb-6 text-muted-foreground">DREAMS.md</h2>
        <RunResultView content={dreams?.content ?? null} />
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
      <p className="swiss-label mb-4 text-muted-foreground">{eyebrow}</p>
      <h1 className="font-semibold text-3xl tracking-tight">{title}</h1>
      <p className="mt-5 max-w-2xl text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </header>
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
