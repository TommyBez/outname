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

export default function AgentConfigurePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<EditSkeleton />}>
      <AgentConfigure params={params} />
    </Suspense>
  )
}

async function AgentConfigure({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()

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
      <section className="border-foreground border-t-2 py-10">
        <h2 className="swiss-label mb-6 text-accent">Configuration</h2>
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

      <section className="border-foreground border-t-2 py-10" id="integrations">
        <h2 className="swiss-label mb-6 text-accent">Integrations</h2>
        <p className="mb-6 max-w-2xl text-muted-foreground text-sm">
          Route incoming Slack messages to this agent. Install the app once per
          workspace, then bind a channel, DM, or workspace fallback.
        </p>
        <Suspense fallback={<div className="h-32" />}>
          <AgentSlackSection agentId={agentRow.id} userId={session.user.id} />
        </Suspense>
      </section>

      <section className="border-foreground border-t-2 py-10" id="budget">
        <h2 className="swiss-label mb-6 text-accent">Budget</h2>
        <Suspense fallback={<div className="h-32" />}>
          <AgentBudgetSection
            agentId={agentRow.id}
            agentName={agentRow.name}
            userId={session.user.id}
          />
        </Suspense>
      </section>

      <section
        className="border-foreground border-t-2 py-10"
        id="assisted-editing"
      >
        <h2 className="swiss-label mb-6 text-accent">Assisted editing</h2>
        <p className="mb-4 max-w-2xl text-muted-foreground text-sm">
          Describe configuration changes in chat, review the proposed update,
          then approve it. Manual controls remain the canonical settings above.
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
