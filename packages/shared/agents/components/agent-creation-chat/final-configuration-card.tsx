'use client'

import type { AgentCreationRequest } from '@outname/shared/agents/server/creation-types'
import {
  budgetReviewLines,
  dreamingLabel,
  scheduleLabel,
  stepLimitLabel,
} from './review-labels'

const INFERENCE_PROVIDER_DISPLAY_NAMES = {
  'llm-gateway': 'LLM Gateway',
  openrouter: 'OpenRouter',
  'vercel-ai-gateway': 'Vercel AI Gateway',
} satisfies Record<AgentCreationRequest['inferenceProvider'], string>

export function FinalConfigurationCard({
  config,
  timeZone,
}: {
  config: AgentCreationRequest | undefined
  timeZone: string
}) {
  if (!config) {
    return null
  }

  const maintainerTools = config.tools?.maintainer ?? []
  const subAgents = config.tools?.subAgents ?? []

  return (
    <section className="w-full border border-border bg-background">
      <div className="border-border border-b bg-brand px-4 py-3">
        <p className="font-bold text-xs uppercase tracking-[0.18em]">
          Review before creation
        </p>
      </div>
      <div className="grid gap-5 p-4 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-5">
          <div>
            <p className="font-black font-serif text-3xl uppercase leading-none tracking-tighter">
              {config.name}
            </p>
            <p className="mt-2 text-muted-foreground text-sm">{config.role}</p>
          </div>

          <ReviewBlock label="Behavior" value={config.behavior} />
          <ReviewBlock
            label="Runtime"
            value={[
              `Provider: ${displayInferenceProvider(config.inferenceProvider)}`,
              `Model: ${config.model}`,
              `Step limit: ${stepLimitLabel(config.stepLimit)}`,
              `Heartbeat: ${scheduleLabel(config.heartbeat, timeZone)}`,
              `Dreaming: ${dreamingLabel(config.dreaming)}`,
            ].join('\n')}
          />
          <ReviewBlock
            label="Memory seeds"
            value={[
              config.identityCard ? 'IDENTITY.md prepared' : null,
              config.soul ? 'SOUL.md prepared' : null,
              config.instructions
                ? 'AGENTS.md custom instructions prepared'
                : null,
              config.userProfile ? 'USER.md prepared' : null,
            ]
              .filter(Boolean)
              .join('\n')}
          />
          <ReviewBlock
            label="Budget"
            value={budgetReviewLines(config.budget).join('\n')}
          />
        </div>

        <aside className="border-border border-t pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-4">
          <ToolList maintainerTools={maintainerTools} subAgents={subAgents} />
        </aside>
      </div>
    </section>
  )
}

function displayInferenceProvider(
  provider: AgentCreationRequest['inferenceProvider']
): string {
  return INFERENCE_PROVIDER_DISPLAY_NAMES[provider] ?? provider
}

function ToolList({
  maintainerTools,
  subAgents,
}: {
  maintainerTools: AgentCreationRequest['tools']['maintainer']
  subAgents: AgentCreationRequest['tools']['subAgents']
}) {
  return (
    <div>
      <p className="font-bold text-xs uppercase tracking-[0.16em]">Tools</p>
      {maintainerTools.length === 0 && subAgents.length === 0 ? (
        <p className="mt-2 text-muted-foreground text-sm">No optional tools</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {maintainerTools.map((tool) => (
            <li
              className="border border-border px-2 py-1 font-mono text-xs"
              key={tool.toolId}
            >
              {tool.toolId}
            </li>
          ))}
          {subAgents.map((tool) => (
            <li
              className="border border-border px-2 py-1 font-mono text-xs"
              key={tool.childAgentId}
            >
              agent:{tool.childAgentId}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReviewBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border border-t pt-3">
      <p className="font-bold text-xs uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
        {value || 'None'}
      </p>
    </div>
  )
}
