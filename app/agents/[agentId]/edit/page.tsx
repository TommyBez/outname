import { Suspense } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { requireSession } from "@/lib/auth-guard"
import { getCachedAgentByIdForUser } from "@/lib/data"
import { AgentForm } from "@/components/agent-form"
import { deleteAgentAction } from "@/lib/agent-actions"
import { DEFAULT_MODEL_ID, getAvailableModels } from "@/lib/ai-gateway-models"

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

  // Fetch the agent + the AI Gateway model catalog in parallel. The
  // catalog is internally `revalidate: 3600`, so the gateway hit is
  // shared across all visitors.
  const [agentRow, models] = await Promise.all([
    getCachedAgentByIdForUser(agentId, session.user.id),
    getAvailableModels(),
  ])
  if (!agentRow) notFound()

  async function remove() {
    "use server"
    await deleteAgentAction(agentId)
  }

  return (
    <>
      <Link
        href={`/agents/${agentRow.id}`}
        className="mb-6 inline-block font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
      >
        ← {agentRow.name}
      </Link>

      <header className="mb-10 flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Configure
        </p>
        <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
          {agentRow.name}
        </h1>
      </header>

      <section className="border-t border-border py-10">
        <AgentForm
          models={models}
          defaultModel={DEFAULT_MODEL_ID}
          initial={{
            id: agentRow.id,
            name: agentRow.name,
            systemPrompt: agentRow.systemPrompt,
            model: agentRow.model,
            heartbeatEnabled: agentRow.heartbeatEnabled,
            heartbeatIntervalMinutes: agentRow.heartbeatIntervalMinutes,
          }}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-destructive/30 pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-destructive">
            Danger zone
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Deleting this agent removes all of its run history and results.
          </p>
        </div>
        <form action={remove} className="self-start sm:self-auto">
          <button
            type="submit"
            className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive hover:text-background"
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
      <div className="border-t border-border py-10">
        <div className="h-64 w-full animate-pulse rounded-sm bg-muted" />
      </div>
    </>
  )
}
