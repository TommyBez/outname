import { cn } from '@outname/ui/lib/utils'

const PARENTHETICAL = /(\([^)]*\))/g

function lineClass(line: string): string {
  const trimmed = line.trimStart()
  if (trimmed.startsWith('#')) {
    return 'font-semibold text-foreground'
  }
  if (trimmed.startsWith('+')) {
    return 'text-brand'
  }
  if (trimmed.startsWith('- [x]')) {
    return 'text-muted-foreground line-through'
  }
  if (trimmed.startsWith('└') || trimmed.startsWith('├')) {
    return 'text-muted-foreground'
  }
  return 'text-foreground/80'
}

function renderInline(line: string) {
  if (line.length === 0) {
    return ' '
  }
  return line.split(PARENTHETICAL).map((part, index) => {
    const key = `${index}-${part}`
    if (part.startsWith('(') && part.endsWith(')')) {
      return (
        <span className="text-muted-foreground" key={key}>
          {part}
        </span>
      )
    }
    return <span key={key}>{part}</span>
  })
}

/** Light, chrome-less syntax-highlighted code lines with a faint number gutter. */
export function CodeLines({
  code,
  className,
}: {
  code: string
  className?: string
}) {
  const lines = code.split('\n')

  return (
    <pre
      className={cn(
        'overflow-x-auto font-mono text-[11px] leading-[1.75] sm:text-xs',
        className
      )}
    >
      <code className="grid">
        {lines.map((line, index) => {
          const key = index
          return (
            <span
              className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3"
              key={key}
            >
              <span className="select-none text-right text-muted-foreground/40 tabular-nums">
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
  )
}
