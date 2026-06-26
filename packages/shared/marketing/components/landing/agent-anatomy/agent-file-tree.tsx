import {
  type AgentTreeNode,
  type AnatomyStepId,
  agentSlug,
  agentTree,
  type FileOwner,
} from '@outname/shared/marketing/data/agent-anatomy'
import { cn } from '@outname/ui/lib/utils'
import { FileTextIcon, FolderIcon } from 'lucide-react'

const DEPTH_INDENT_REM = 0.75

const ownerDot: Record<FileOwner, string> = {
  agent: 'border border-current opacity-50',
  shared: 'bg-current opacity-50',
  user: 'bg-brand',
}

function TreeRow({ active, node }: { active: boolean; node: AgentTreeNode }) {
  const Icon = node.kind === 'dir' ? FolderIcon : FileTextIcon
  const isStepNode = Boolean(node.stepId)

  return (
    <li>
      <span
        className={cn(
          'ease flex items-center gap-2 border-l-2 py-1.5 pr-3 font-mono text-xs tracking-normal transition-colors duration-200',
          active
            ? 'border-brand bg-foreground text-background'
            : 'border-transparent text-muted-foreground'
        )}
        style={{ paddingLeft: `${node.depth * DEPTH_INDENT_REM + 0.5}rem` }}
      >
        <Icon
          className={cn(
            'size-3.5 shrink-0',
            active ? 'text-background' : 'text-muted-foreground'
          )}
        />
        <span
          className={cn(
            'truncate',
            active && 'font-semibold',
            !(active || isStepNode) && 'opacity-70'
          )}
        >
          {node.label}
        </span>
        {node.owner ? (
          <span
            aria-hidden
            className={cn('ml-auto size-2 shrink-0', ownerDot[node.owner])}
          />
        ) : null}
      </span>
    </li>
  )
}

export function AgentFileTree({
  activeStepId,
  className,
}: {
  activeStepId?: AnatomyStepId
  className?: string
}) {
  return (
    <div className={cn('border border-border bg-background', className)}>
      <div className="flex items-center gap-2 border-border border-b px-4 py-3">
        <span aria-hidden className="size-2.5 shrink-0 bg-brand" />
        <span className="truncate font-mono text-xs tracking-normal">
          {agentSlug}/
        </span>
        <span className="swiss-label ml-auto text-muted-foreground">
          sandbox
        </span>
      </div>
      <ul className="py-2">
        {agentTree.map((node) => (
          <TreeRow
            active={Boolean(node.stepId && node.stepId === activeStepId)}
            key={node.id}
            node={node}
          />
        ))}
      </ul>
      <div className="flex items-center gap-4 border-border border-t px-4 py-2.5 font-mono text-[10px] text-muted-foreground tracking-normal">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 bg-brand" /> you author
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2 border border-muted-foreground opacity-50"
          />{' '}
          agent writes
        </span>
      </div>
    </div>
  )
}
