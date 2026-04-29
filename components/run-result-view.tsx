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
      <div className="border-foreground border-t-2 pt-10">
        <p className="text-pretty font-black font-serif text-2xl text-muted-foreground uppercase leading-none tracking-[-0.04em]">
          No content for this run.
        </p>
      </div>
    )
  }

  return (
    <article
      className={cn(
        'prose prose-neutral max-w-none border-foreground border-t-2 pt-10',
        'prose-headings:font-black prose-headings:font-serif prose-headings:uppercase prose-headings:tracking-tighter',
        'prose-p:text-pretty prose-p:leading-relaxed',
        'prose-code:font-mono'
      )}
    >
      <Streamdown plugins={plugins}>{content}</Streamdown>
    </article>
  )
}
