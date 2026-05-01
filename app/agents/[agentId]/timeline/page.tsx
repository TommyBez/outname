import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { RunResultView } from '@/components/run-result-view'
import { requireSession } from '@/lib/auth-guard'
import { getCachedAgentByIdForUser, getCachedAgentLogFiles } from '@/lib/data'
import { formatRelative } from '@/lib/format'

type Params = Promise<{ agentId: string }>

const LOGS_PREFIX_RE = /^logs\//
const MARKDOWN_EXTENSION_RE = /\.md$/

export default function AgentTimelinePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<TimelineSkeleton />}>
      <ResolvedAgentTimeline params={params} />
    </Suspense>
  )
}

async function ResolvedAgentTimeline({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const logs = await getCachedAgentLogFiles(agent.id)

  return (
    <>
      <header className="mb-12 border-foreground border-t-4 pt-6">
        <p className="swiss-label mb-4 text-accent">{agent.name} · Timeline</p>
        <h1 className="font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter md:text-7xl">
          Daily logs
        </h1>
        <p className="mt-5 max-w-2xl border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
          The agent&apos;s markdown event log, mirrored from its system sandbox
          after each chat, heartbeat, reflection, or sub-agent invocation.
        </p>
      </header>

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

function formatLogPath(path: string): string {
  return path.replace(LOGS_PREFIX_RE, '').replace(MARKDOWN_EXTENSION_RE, '')
}

function TimelineSkeleton() {
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
