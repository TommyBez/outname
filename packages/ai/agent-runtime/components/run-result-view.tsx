'use client'

import { cn } from '@outname/ui/lib/utils'
import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { math } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import { Streamdown } from 'streamdown'

const plugins = { cjk, code, math, mermaid }

export function RunResultView({ content }: { content: string | null }) {
  if (!content || content.trim().length === 0) {
    return (
      <div className="border-foreground border-t-2 pt-10">
        <p className="text-pretty font-black font-serif text-2xl text-muted-foreground uppercase leading-none tracking-[-0.04em]">
          No content yet.
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
