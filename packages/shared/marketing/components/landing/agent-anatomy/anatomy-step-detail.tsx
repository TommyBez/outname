import type { AnatomyStep } from '@outname/shared/marketing/data/agent-anatomy'
import { Badge } from '@outname/ui/components/ui/badge'
import { cn } from '@outname/ui/lib/utils'
import { stepIcons } from './constants'

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

export function AnatomyStepDetail({
  step,
  total,
}: {
  step: AnatomyStep
  total: number
}) {
  const Icon = stepIcons[step.id]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <p className="swiss-label text-muted-foreground">
          {step.index} / {String(total).padStart(2, '0')}
        </p>
        <span className="grid size-12 place-items-center border border-border bg-brand text-brand-foreground">
          <Icon className="size-5" />
        </span>
      </div>

      <h3 className="mt-6 font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
        {step.title}
      </h3>

      <p className="mt-5 max-w-md text-muted-foreground leading-relaxed">
        {step.caption}
      </p>

      <AnatomyCodeBlock className="mt-7" code={step.code} />

      <div className="mt-6 flex items-center gap-2">
        <span className="swiss-label text-muted-foreground">runs on</span>
        <Badge variant="outline">{step.primitive}</Badge>
      </div>
    </div>
  )
}
