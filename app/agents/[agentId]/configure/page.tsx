import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AgentDeleteDialog } from '@/agents/components/agent-delete-dialog'
import { AgentEditChat } from '@/agents/components/agent-edit-chat'
import {
  AgentBudgetSection,
  AgentDiscordSection,
  AgentSlackSection,
  EditSkeleton,
  summarizeBudgetRules,
} from '@/agents/components/agent-edit-sections'
import { AgentForm } from '@/agents/components/agent-form'
import { deleteAgentAction } from '@/agents/server/actions'
import { customInstructionsFromAgentsMd } from '@/agents/server/bootstrap-files'
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
import { getUserTimeDisplay } from '@/shared/server/user-time-display'

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
    identityFile,
    soulFile,
    agentsMdFile,
    userMdFile,
    budgetRules,
    display,
  ] = await Promise.all([
    getCachedAgentByIdForUser(agentId, session.user.id),
    getAvailableModels(),
    getCachedAgentMemoryFile({ agentId, path: 'IDENTITY.md' }),
    getCachedAgentMemoryFile({ agentId, path: 'SOUL.md' }),
    getCachedAgentMemoryFile({ agentId, path: 'AGENTS.md' }),
    getCachedAgentMemoryFile({ agentId, path: 'USER.md' }),
    listAgentBudgetRules({ userId: session.user.id, agentId }),
    getUserTimeDisplay(session.user.id),
  ])
  if (!agentRow) {
    notFound()
  }
  const instructions = agentsMdFile?.content
    ? customInstructionsFromAgentsMd(agentsMdFile.content)
    : ''
  const userProfile = userMdFile?.content ?? ''

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
            identityCard: identityFile?.content ?? '',
            identity: soulFile?.content ?? '',
            instructions,
            userProfile,
            model: agentRow.model,
            heartbeatEnabled: agentRow.heartbeatEnabled,
            heartbeatScheduleMode: agentRow.heartbeatScheduleMode,
            heartbeatScheduleTimes: agentRow.heartbeatScheduleTimes,
            heartbeatIntervalMinutes: agentRow.heartbeatIntervalMinutes,
            dreamingEnabled: agentRow.dreamingEnabled,
            stepLimitMode: (agentRow.stepLimitMode ?? 'medium') as
              | 'custom'
              | 'grind'
              | 'high'
              | 'low'
              | 'medium',
            stepLimitCustom: agentRow.stepLimitCustom,
          }}
          models={models}
          timezoneLabel={display.timezoneLabel}
        />
      </section>

      <section className="border-foreground border-t-2 py-10" id="integrations">
        <h2 className="swiss-label mb-6 text-accent">Integrations</h2>
        <p className="mb-6 max-w-2xl text-muted-foreground text-sm">
          Route incoming Slack and Discord messages to this agent. Install each
          provider first, then bind the specific channel or DM scope that should
          reach this agent.
        </p>
        <div className="flex flex-col gap-10">
          <Suspense fallback={<div className="h-32" />}>
            <AgentSlackSection agentId={agentRow.id} userId={session.user.id} />
          </Suspense>
          <Suspense fallback={<div className="h-32" />}>
            <AgentDiscordSection
              agentId={agentRow.id}
              userId={session.user.id}
            />
          </Suspense>
        </div>
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
            identityCard: identityFile?.content ?? '',
            instructions,
            soul: soulFile?.content ?? '',
            userProfile,
          }}
          currentSettings={{
            heartbeatEnabled: agentRow.heartbeatEnabled,
            heartbeatScheduleMode: agentRow.heartbeatScheduleMode,
            heartbeatScheduleTimes: agentRow.heartbeatScheduleTimes,
            heartbeatIntervalMinutes: agentRow.heartbeatIntervalMinutes,
            model: agentRow.model,
            name: agentRow.name,
            dreamingEnabled: agentRow.dreamingEnabled,
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
        <div className="self-start sm:self-auto">
          <AgentDeleteDialog agentName={agentRow.name} onDelete={remove} />
        </div>
      </section>
    </>
  )
}
