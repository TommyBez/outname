'use client'

import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { math } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import { Streamdown } from 'streamdown'
import { cn } from '@/lib/utils'

/**
 * Agent-agnostic run result renderer.
 *
 * Every completed run persists its output as a single markdown document
 * on `run_result.content`. This component is the generic viewer for
 * that document: the same Streamdown + plugin stack used by the chat
 * transcript, wrapped in the project's serif/mono editorial tone.
 *
 * It has no knowledge of Gmail, categories, or any agent-specific data
 * shape — it simply renders whatever markdown the agent produced.
 */
const plugins = { cjk, code, math, mermaid }

export function RunResultView({ content }: { content: string | null }) {
  if (!content || content.trim().length === 0) {
    return (
      <div className="border-border border-t pt-10">
        <p className="text-pretty font-serif text-2xl text-muted-foreground leading-snug">
          No content for this run.
        </p>
      </div>
    )
  }

  return (
    <article
      className={cn(
        'prose prose-neutral dark:prose-invert max-w-none border-border border-t pt-10',
        'prose-headings:font-medium prose-headings:font-serif prose-headings:tracking-tight',
        'prose-p:text-pretty prose-p:leading-relaxed',
        'prose-code:font-mono'
      )}
    >
      <Streamdown plugins={plugins}>{content}</Streamdown>
    </article>
  )
}
