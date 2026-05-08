import {
  AlertTriangleIcon,
  CheckIcon,
  CircleDashedIcon,
  XIcon,
} from 'lucide-react'
import { CreationSuccessCard } from './creation-success-card'
import { FinalConfigurationCard } from './final-configuration-card'
import type { CreateAgentToolPart, ToolApprovalResponder } from './types'

export function CreateAgentToolCard({
  part,
  addToolApprovalResponse,
}: {
  addToolApprovalResponse: ToolApprovalResponder
  part: CreateAgentToolPart
}) {
  if (part.state === 'input-streaming' || part.state === 'input-available') {
    return (
      <div className="w-full border-2 border-foreground bg-muted p-4">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-[0.16em]">
          <CircleDashedIcon className="size-4 animate-spin" />
          Preparing configuration
        </div>
      </div>
    )
  }

  if (part.state === 'approval-requested') {
    return (
      <FinalConfigurationCard
        config={part.input}
        onApprove={() =>
          addToolApprovalResponse({
            id: part.approval?.id ?? '',
            approved: true,
            reason: 'User approved agent creation.',
          })
        }
        onDeny={() =>
          addToolApprovalResponse({
            id: part.approval?.id ?? '',
            approved: false,
            reason: 'User denied agent creation and wants changes.',
          })
        }
      />
    )
  }

  if (part.state === 'approval-responded') {
    return (
      <div className="w-full border-2 border-foreground bg-muted p-4">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-[0.16em]">
          {part.approval?.approved ? (
            <CheckIcon className="size-4" />
          ) : (
            <XIcon className="size-4" />
          )}
          {part.approval?.approved ? 'Approved' : 'Denied'}
        </div>
      </div>
    )
  }

  if (part.state === 'output-available' && part.output) {
    return <CreationSuccessCard result={part.output} />
  }

  if (part.state === 'output-denied') {
    return (
      <div className="w-full border-2 border-foreground bg-muted p-4">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-[0.16em]">
          <XIcon className="size-4" />
          Creation denied
        </div>
      </div>
    )
  }

  if (part.state === 'output-error') {
    return (
      <div className="w-full border-2 border-destructive bg-destructive/5 p-4">
        <div className="flex items-center gap-2 font-bold text-destructive text-xs uppercase tracking-[0.16em]">
          <AlertTriangleIcon className="size-4" />
          Creation failed
        </div>
        <p className="mt-2 text-destructive text-sm">
          {part.errorText ?? 'The agent was not created.'}
        </p>
      </div>
    )
  }

  return null
}
