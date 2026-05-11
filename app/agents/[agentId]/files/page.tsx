import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/auth/server/auth-guard'
import { db } from '@/shared/db'
import { agentFiles } from '@/shared/db/schema'
import { getCachedAgentByIdForUser } from '@/shared/server/data'
import { formatRelative } from '@/shared/server/format'

type Params = Promise<{ agentId: string }>

/**
 * Admin / debug surface — read-only listing of every markdown file the
 * agent's session has flushed from its sandbox into `agent_files`.
 *
 * Phase 1 deliverable: lets reviewers verify that
 * `endOfEvent` is correctly snapshotting the sandbox after each chat
 * turn / heartbeat without having to SSH into a sandbox or read the DB
 * directly. Phase 2 will replace this with a richer "memory browser"
 * once agents start authoring more than just the bootstrap files.
 *
 * Owner-scoped via `getCachedAgentByIdForUser`; the file listing
 * inherits that authorization and filters by `agentId` in the query.
 */
export default function AgentFilesPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<FilesSkeleton />}>
      <ResolvedAgentFiles params={params} />
    </Suspense>
  )
}

async function ResolvedAgentFiles({ params }: { params: Params }) {
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
      <header className="mb-12 border-foreground border-t-4 pt-6">
        <p className="swiss-label mb-4 text-accent">{agent.name} · Files</p>
        <h1 className="font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter md:text-7xl">
          Sandbox memory
        </h1>
        <p className="mt-5 max-w-2xl border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
          Markdown notes the agent maintains inside its persistent sandbox.
          Snapshotted to the database at the end of every chat turn and
          heartbeat.
        </p>
      </header>

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

function FilesSkeleton() {
  return (
    <>
      <header className="mb-10 flex flex-col gap-2">
        <div className="h-3 w-32 animate-pulse rounded-sm bg-muted" />
        <div className="h-10 w-72 animate-pulse rounded-sm bg-muted" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded-sm bg-muted" />
      </header>
      <div className="flex flex-col gap-10">
        {[0, 1].map((idx) => (
          <div className="flex flex-col gap-3" key={idx}>
            <div className="flex items-baseline justify-between border-border border-b pb-2">
              <div className="h-4 w-40 animate-pulse rounded-sm bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
            </div>
            <div className="h-48 w-full animate-pulse rounded-md bg-muted/40" />
          </div>
        ))}
      </div>
    </>
  )
}
