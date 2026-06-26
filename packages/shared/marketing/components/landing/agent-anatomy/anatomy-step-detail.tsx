import {
  type AnatomyStep,
  agentTree,
  ownerLabel,
} from '@outname/shared/marketing/data/agent-anatomy'
import { Badge } from '@outname/ui/components/ui/badge'
import { cn } from '@outname/ui/lib/utils'
import { stepIcons } from './constants'

const fileNameByNode = new Map(agentTree.map((node) => [node.id, node.label]))

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
  const fileName = fileNameByNode.get(step.node) ?? step.node

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

      <p className="mt-6 font-mono text-muted-foreground text-xs tracking-normal">
        {fileName}
      </p>
      <h3 className="mt-2 font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
        {step.title}
      </h3>

      <p className="mt-5 max-w-md text-muted-foreground leading-relaxed">
        {step.caption}
      </p>

      <AnatomyCodeBlock className="mt-7" code={step.code} />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge
          className={cn(
            step.owner === 'user' &&
              'border-transparent bg-brand text-brand-foreground'
          )}
          variant={step.owner === 'user' ? 'default' : 'outline'}
        >
          {ownerLabel[step.owner]}
        </Badge>
        <span className="swiss-label text-muted-foreground">{step.note}</span>
      </div>
    </div>
  )
}
