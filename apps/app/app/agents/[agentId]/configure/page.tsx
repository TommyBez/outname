import { requireSession } from '@outname/auth/server/auth-guard'
import type { InferenceProvider } from '@outname/db/schema'
import { AgentBudgetSection } from '@outname/shared/agents/components/agent-budget-section'
import { AgentDeleteDialog } from '@outname/shared/agents/components/agent-delete-dialog'
import { AgentEditChat } from '@outname/shared/agents/components/agent-edit-chat'
import { summarizeBudgetRules } from '@outname/shared/agents/components/agent-edit-sections-helpers'
import { AgentForm } from '@outname/shared/agents/components/agent-form'
import { AgentSlackSection } from '@outname/shared/agents/components/agent-slack-section'
import { EditSkeleton } from '@outname/shared/agents/components/edit-skeleton'
import { deleteAgentAction } from '@outname/shared/agents/server/actions'
import { customInstructionsFromAgentsMd } from '@outname/shared/agents/server/bootstrap-files'
import { listAgentBudgetRules } from '@outname/shared/budgets/server/rules'
import {
  getCachedAgentByIdForUser,
  getCachedAgentMemoryFile,
} from '@outname/shared/server/data'
import {
  DEFAULT_MODEL_BY_PROVIDER,
  DEFAULT_MODEL_ID,
  getAvailableModels,
} from '@outname/shared/server/inference-models'
import {
  DEFAULT_INFERENCE_PROVIDER,
  displayInferenceProvider,
  listEnabledInferenceProviders,
} from '@outname/shared/server/inference-providers'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { getUserTimeDisplay } from '@outname/shared/server/user-time-display'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent configuration',
  'Configure private OUTNA.ME agent identity, runtime, channels, and budgets.'
)

export default function AgentConfigurePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<EditSkeleton />}>
      <AgentConfigure params={params} />
    </Suspense>
  )
}

async function AgentConfigure({ params }: { params: Params }) {
  const [{ agentId }, session] = await Promise.all([params, requireSession()])

  const [
    agentRow,
    identityFile,
    soulFile,
    agentsMdFile,
    userMdFile,
    budgetRules,
    display,
    enabledProviders,
  ] = await Promise.all([
    getCachedAgentByIdForUser(agentId, session.user.id),
    getCachedAgentMemoryFile({ agentId, path: 'IDENTITY.md' }),
    getCachedAgentMemoryFile({ agentId, path: 'SOUL.md' }),
    getCachedAgentMemoryFile({ agentId, path: 'AGENTS.md' }),
    getCachedAgentMemoryFile({ agentId, path: 'USER.md' }),
    listAgentBudgetRules({ userId: session.user.id, agentId }),
    getUserTimeDisplay(session.user.id),
    listEnabledInferenceProviders(session.user.id),
  ])
  if (!agentRow) {
    notFound()
  }
  const providers = providerOptions({
    current: agentRow.inferenceProvider,
    enabled: enabledProviders,
  })
  const models = (
    await Promise.all(
      providers.map((provider) =>
        getAvailableModels({ inferenceProvider: provider.value })
      )
    )
  ).flat()
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
      <section className="border-border border-t py-10">
        <h2 className="swiss-label mb-6 text-brand">Configuration</h2>
        <AgentForm
          defaultInferenceProvider={DEFAULT_INFERENCE_PROVIDER}
          defaultModel={DEFAULT_MODEL_ID}
          defaultModelByProvider={DEFAULT_MODEL_BY_PROVIDER}
          initial={{
            id: agentRow.id,
            name: agentRow.name,
            identityCard: identityFile?.content ?? '',
            identity: soulFile?.content ?? '',
            instructions,
            userProfile,
            inferenceProvider: agentRow.inferenceProvider,
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
          providers={providers}
          timezoneLabel={display.timezoneLabel}
        />
      </section>

      <section className="border-border border-t py-10" id="integrations">
        <h2 className="swiss-label mb-6 text-brand">Integrations</h2>
        <p className="mb-6 max-w-2xl text-muted-foreground text-sm">
          Route incoming Slack messages to this agent. Install the app once per
          workspace, then bind a channel, DM, or workspace fallback.
        </p>
        <Suspense fallback={<div className="h-32" />}>
          <AgentSlackSection agentId={agentRow.id} userId={session.user.id} />
        </Suspense>
      </section>

      <section className="border-border border-t py-10" id="budget">
        <h2 className="swiss-label mb-6 text-brand">Budget</h2>
        <Suspense fallback={<div className="h-32" />}>
          <AgentBudgetSection
            agentId={agentRow.id}
            agentName={agentRow.name}
            userId={session.user.id}
          />
        </Suspense>
      </section>

      <section className="border-border border-t py-10" id="assisted-editing">
        <h2 className="swiss-label mb-6 text-brand">Assisted editing</h2>
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
            inferenceProvider: agentRow.inferenceProvider,
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

      <section className="flex flex-col gap-3 border-destructive border-t pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <p className="font-bold text-destructive text-xs">Danger zone</p>
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

function providerOptions(input: {
  current: InferenceProvider
  enabled: InferenceProvider[]
}) {
  const values = new Set<InferenceProvider>([input.current, ...input.enabled])
  return [...values].map((value) => ({
    configured: input.enabled.includes(value),
    label: displayInferenceProvider(value),
    value,
  }))
}
