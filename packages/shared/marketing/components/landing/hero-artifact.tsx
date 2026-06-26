'use client'

import { AgentFileTree } from '@outname/shared/marketing/components/landing/agent-anatomy/agent-file-tree'
import { CodeLines } from '@outname/shared/marketing/components/landing/code-block'
import { cn } from '@outname/ui/lib/utils'
import { FileTextIcon } from 'lucide-react'
import { useState } from 'react'

type ArtifactView = 'human' | 'agent'

// A real excerpt of the AGENTS.md the runtime seeds — the first thing the
// agent reads on every event.
const AGENT_VIEW_CODE = `# AGENTS.md
Read this at the start of every event.

## User custom instructions
- Triage Slack before 09:00.
- Never send external email
  without a confirm.`

const views: readonly { id: ArtifactView; label: string }[] = [
  { id: 'human', label: 'For you' },
  { id: 'agent', label: 'For the agent' },
]

export function HeroArtifact() {
  const [view, setView] = useState<ArtifactView>('human')

  return (
    <div>
      <div
        aria-label="Artifact view"
        className="inline-flex items-center gap-5 text-sm"
        role="tablist"
      >
        {views.map((option) => {
          const active = view === option.id
          return (
            <button
              aria-selected={active}
              className={cn(
                'ease border-b-2 pb-1 font-medium transition-colors duration-150',
                active
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              key={option.id}
              onClick={() => setView(option.id)}
              role="tab"
              type="button"
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {/* Both views share one grid cell so the panel keeps the taller height
          and switching tabs never shifts the layout. */}
      <div className="mt-4 grid">
        <div
          aria-hidden={view !== 'human'}
          className={cn(
            'col-start-1 row-start-1',
            view === 'human' ? '' : 'invisible'
          )}
        >
          <AgentFileTree />
        </div>
        <div
          aria-hidden={view !== 'agent'}
          className={cn(
            'col-start-1 row-start-1 flex flex-col border border-border bg-card',
            view === 'agent' ? '' : 'invisible'
          )}
        >
          <div className="flex items-center gap-2 border-border border-b bg-muted px-4 py-2.5">
            <FileTextIcon className="size-3.5 text-brand" />
            <span className="font-mono text-foreground text-xs">AGENTS.md</span>
          </div>
          <div className="flex-1 px-4 py-4">
            <CodeLines code={AGENT_VIEW_CODE} />
          </div>
        </div>
      </div>
    </div>
  )
}
