import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AgentEditChat } from '@/agents/components/agent-edit-chat'
import {
  AgentBudgetSection,
  AgentSlackSection,
  EditSkeleton,
  summarizeBudgetRules,
} from '@/agents/components/agent-edit-sections'
import { AgentForm } from '@/agents/components/agent-form'
import { deleteAgentAction } from '@/agents/server/actions'
import { readLatestPendingFileWrite } from '@/agents/server/pending-writes'
import { requireSession } from '@/auth/server/auth-guard'
import { listAgentBudgetRules } from '@/budgets/server/rules'
import {
  DEFAULT_MODEL_ID,
  getAvailableModels,
} from '@/shared/server/ai-gateway-models'
import {
  getCachedAgentByIdForUser,
  getCachedAgentMemoryFile,
} from '@/shared/server/data'

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
  // also evolve through the agent's own writeFile tool, so fall back to
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
    budgetRules,
  ] = await Promise.all([
    getCachedAgentByIdForUser(agentId, session.user.id),
    getAvailableModels(),
    readLatestPendingFileWrite({ agentId, path: 'IDENTITY.md' }),
    readLatestPendingFileWrite({ agentId, path: 'SOUL.md' }),
    readLatestPendingFileWrite({ agentId, path: 'AGENTS.md' }),
    readLatestPendingFileWrite({ agentId, path: 'USER.md' }),
    getCachedAgentMemoryFile({ agentId, path: 'USER.md' }),
    listAgentBudgetRules({ userId: session.user.id, agentId }),
  ])
  if (!agentRow) {
    notFound()
  }
  const userProfile =
    userMdRow && (!userMdFile || userMdRow.enqueuedAt >= userMdFile.updatedAt)
      ? userMdRow.content
      : (userMdFile?.content ?? '')

  const currentBudget = summarizeBudgetRules(budgetRules)

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
        <h2 className="swiss-label mb-6 text-accent">Budget</h2>
        <Suspense fallback={<div className="h-32" />}>
          <AgentBudgetSection
            agentId={agentRow.id}
            agentName={agentRow.name}
            userId={session.user.id}
          />
        </Suspense>
      </section>

      <section className="border-foreground border-t-2 py-10">
        <h2 className="swiss-label mb-6 text-accent">Slack</h2>
        <p className="mb-6 max-w-2xl text-muted-foreground text-sm">
          Route incoming Slack messages to this agent. Install the app once per
          workspace, then bind a channel, DM, or workspace fallback.
        </p>
        <Suspense fallback={<div className="h-32" />}>
          <AgentSlackSection agentId={agentRow.id} userId={session.user.id} />
        </Suspense>
      </section>

      <section className="border-foreground border-t-2 py-10">
        <p className="mb-3 font-bold text-xs uppercase tracking-[0.14em]">
          Manual editing
        </p>
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
            stepLimitMode: (agentRow.stepLimitMode ?? 'medium') as
              | 'custom'
              | 'grind'
              | 'high'
              | 'low'
              | 'medium',
            stepLimitCustom: agentRow.stepLimitCustom,
          }}
          models={models}
        />
      </section>

      <section className="border-foreground border-t-2 py-10">
        <p className="mb-3 font-bold text-xs uppercase tracking-[0.14em]">
          Chat editing
        </p>
        <p className="mb-4 max-w-2xl text-muted-foreground text-sm">
          Use chat to describe changes. Review the proposed update, then approve
          to apply. Manual editing remains available above.
        </p>
        <AgentEditChat
          agentId={agentRow.id}
          currentBudget={currentBudget}
          currentMarkdownFiles={{
            identityCard: identityRow?.content ?? '',
            instructions: agentsMdRow?.content ?? '',
            soul: soulRow?.content ?? '',
            userProfile,
          }}
          currentSettings={{
            heartbeatEnabled: agentRow.heartbeatEnabled,
            heartbeatIntervalMinutes: agentRow.heartbeatIntervalMinutes,
            model: agentRow.model,
            name: agentRow.name,
            reflectionEnabled: agentRow.reflectionEnabled,
            reflectionIntervalMinutes: agentRow.reflectionIntervalMinutes,
            stepLimitCustom: agentRow.stepLimitCustom,
            stepLimitMode: (agentRow.stepLimitMode ?? 'medium') as
              | 'custom'
              | 'grind'
              | 'high'
              | 'low'
              | 'medium',
          }}
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
