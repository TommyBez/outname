'use client'

import { AgentFileTree } from '@outname/shared/marketing/components/landing/agent-anatomy/agent-file-tree'
import { CodeWindow } from '@outname/shared/marketing/components/landing/code-window'
import { Button } from '@outname/ui/components/ui/button'
import { cn } from '@outname/ui/lib/utils'
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
      <div className="flex items-center justify-between gap-3">
        <div
          aria-label="Artifact view"
          className="inline-flex border border-border"
          role="tablist"
        >
          {views.map((option) => {
            const active = view === option.id
            return (
              <Button
                aria-selected={active}
                className={cn(
                  'rounded-none border-border not-last:border-r font-normal normal-case tracking-normal',
                  active
                    ? 'bg-foreground text-background hover:bg-foreground'
                    : 'text-muted-foreground'
                )}
                key={option.id}
                onClick={() => setView(option.id)}
                role="tab"
                size="sm"
                type="button"
                variant="ghost"
              >
                {option.label}
              </Button>
            )
          })}
        </div>
        <span className="swiss-label text-muted-foreground">
          {view === 'human' ? 'directory' : 'read every event'}
        </span>
      </div>

      <div className="mt-3">
        {view === 'human' ? (
          <AgentFileTree />
        ) : (
          <CodeWindow code={AGENT_VIEW_CODE} filename="AGENTS.md" />
        )}
      </div>
    </div>
  )
}
