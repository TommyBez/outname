'use client'

import { streamdownPlugins } from '@outname/ai/components/ai-elements/streamdown-plugins'
import { cn } from '@outname/ui/lib/utils'
import { Streamdown } from 'streamdown'

export function RunResultView({ content }: { content: string | null }) {
  if (!content || content.trim().length === 0) {
    return (
      <div className="border-border border-t pt-10">
        <p className="text-pretty font-semibold font-serif text-2xl text-muted-foreground leading-none tracking-[-0.04em]">
          No content yet.
        </p>
      </div>
    )
  }

  return (
    <article
      className={cn(
        'prose prose-neutral max-w-none border-border border-t pt-10',
        'prose-headings: prose-headings:font-semibold prose-headings:font-serif prose-headings:tracking-tighter',
        'prose-p:text-pretty prose-p:leading-relaxed',
        'prose-code:font-mono'
      )}
    >
      <Streamdown plugins={streamdownPlugins}>{content}</Streamdown>
    </article>
  )
}
