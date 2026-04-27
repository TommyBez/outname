import { Suspense } from "react"
import { notFound } from "next/navigation"
import { asc, eq } from "drizzle-orm"
import { requireSession } from "@/lib/auth-guard"
import { getCachedAgentByIdForUser } from "@/lib/data"
import { db } from "@/lib/db"
import { agentFiles } from "@/lib/db/schema"
import { formatRelative } from "@/lib/format"

type Params = Promise<{ agentId: string }>

/**
 * Admin / debug surface — read-only listing of every markdown file the
 * agent's session has flushed from its sandbox into `agent_files`.
 *
 * Phase 1 deliverable: lets reviewers verify that
 * `endOfEvent` is correctly snapshotting the sandbox after each chat
 * turn / heartbeat without having to SSH into a sandbox or read the DB
 * directly. Phase 2 will replace this with a richer "memory browser"
 * once agents start authoring more than just `AGENTS.md`.
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
  if (!agent) notFound()

  const rows = await db
    .select()
    .from(agentFiles)
    .where(eq(agentFiles.agentId, agent.id))
    .orderBy(asc(agentFiles.path))

  return (
    <>
      <header className="mb-10 flex flex-col gap-1.5">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {agent.name} · Files
        </p>
        <h1 className="font-serif text-3xl font-medium leading-tight tracking-tight md:text-4xl">
          Sandbox memory
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Markdown notes the agent maintains inside its persistent
          sandbox. Snapshotted to the database at the end of every
          chat turn and heartbeat.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No files yet. The agent will create{" "}
          <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs">
            AGENTS.md
          </code>{" "}
          on its first run.
        </p>
      ) : (
        <ul className="flex flex-col gap-10">
          {rows.map((row) => (
            <li key={row.path} className="flex flex-col gap-3">
              <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border pb-2">
                <h2 className="font-mono text-sm font-medium">{row.path}</h2>
                <span className="font-mono text-xs text-muted-foreground">
                  Updated {formatRelative(row.updatedAt)}
                </span>
              </header>
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed">
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
          <div key={idx} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between border-b border-border pb-2">
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
