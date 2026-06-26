import { cn } from '@outname/ui/lib/utils'

const PARENTHETICAL = /(\([^)]*\))/g

function lineClass(line: string): string {
  const trimmed = line.trimStart()
  if (trimmed.startsWith('#')) {
    return 'text-background font-semibold'
  }
  if (trimmed.startsWith('+')) {
    return 'text-brand'
  }
  if (trimmed.startsWith('- [x]')) {
    return 'text-background/45 line-through'
  }
  if (trimmed.startsWith('└') || trimmed.startsWith('├')) {
    return 'text-background/50'
  }
  return 'text-background/80'
}

function renderInline(line: string) {
  if (line.length === 0) {
    return ' '
  }
  return line.split(PARENTHETICAL).map((part, index) => {
    const key = `${index}-${part}`
    if (part.startsWith('(') && part.endsWith(')')) {
      return (
        <span className="text-background/45" key={key}>
          {part}
        </span>
      )
    }
    return <span key={key}>{part}</span>
  })
}

export function CodeWindow({
  code,
  filename,
  label,
  className,
}: {
  code: string
  filename: string
  /** Optional right-aligned label, e.g. an ownership tag or step index. */
  label?: string
  className?: string
}) {
  const lines = code.split('\n')

  return (
    <div
      className={cn(
        'overflow-hidden border border-border bg-foreground text-background',
        className
      )}
    >
      <div className="flex items-center gap-3 border-background/15 border-b px-4 py-2.5">
        <span aria-hidden className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-background/20" />
          <span className="size-2.5 rounded-full bg-background/20" />
          <span className="size-2.5 rounded-full bg-background/20" />
        </span>
        <span className="ml-1 truncate font-mono text-[11px] text-background/70 tracking-normal">
          {filename}
        </span>
        {label ? (
          <span className="ml-auto shrink-0 font-mono text-[10px] text-background/40 tracking-normal">
            {label}
          </span>
        ) : null}
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[11px] leading-[1.7] sm:text-xs">
        <code className="grid">
          {lines.map((line, index) => {
            const key = index
            return (
              <span
                className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3"
                key={key}
              >
                <span className="select-none text-right text-background/25 tabular-nums">
                  {index + 1}
                </span>
                <span className={cn('whitespace-pre-wrap', lineClass(line))}>
                  {renderInline(line)}
                </span>
              </span>
            )
          })}
        </code>
      </pre>
    </div>
  )
}
