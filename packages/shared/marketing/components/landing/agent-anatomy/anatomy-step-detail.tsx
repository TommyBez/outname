import { cn } from '@outname/ui/lib/utils'

export function AnatomyCodeBlock({
  code,
  className,
}: {
  code: string
  className?: string
}) {
  return (
    <pre
      className={cn(
        'overflow-x-auto border border-border bg-muted p-4 font-mono text-[11px] text-foreground leading-relaxed sm:text-xs',
        className
      )}
    >
      <code>{code}</code>
    </pre>
  )
}
