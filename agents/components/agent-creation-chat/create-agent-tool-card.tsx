import { CheckIcon, XIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from '@/components/ai-elements/confirmation'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
} from '@/components/ai-elements/tool'
import { CreationSuccessCard } from './creation-success-card'
import { FinalConfigurationCard } from './final-configuration-card'
import type { CreateAgentToolPart, ToolApprovalResponder } from './types'

// `CreateAgentToolPart.approval` matches the AI SDK approval shape, but
// `Confirmation` types it as a discriminated union that requires precise
// narrowing of `approved`. Cast at the boundary since the runtime checks
// inside `Confirmation` only inspect `approved === true/false`.
type ConfirmationApproval = ComponentProps<typeof Confirmation>['approval']

export function CreateAgentToolCard({
  part,
  addToolApprovalResponse,
}: {
  addToolApprovalResponse: ToolApprovalResponder
  part: CreateAgentToolPart
}) {
  // While input is streaming, the Tool header's "Pending"/"Running" badge is
  // the entire UI — no redundant spinner panel.
  if (part.state === 'input-streaming' || part.state === 'input-available') {
    return (
      <Tool>
        <ToolHeader state={part.state} type={part.type} />
      </Tool>
    )
  }

  if (part.state === 'approval-requested') {
    const approvalId = part.approval?.id ?? ''
    return (
      <Tool defaultOpen>
        <ToolHeader state={part.state} type={part.type} />
        <ToolContent>
          <FinalConfigurationCard config={part.input} />
          <Confirmation
            approval={part.approval as ConfirmationApproval}
            className="rounded-none border-2 border-foreground"
            state={part.state}
          >
            <ConfirmationRequest>
              <ConfirmationTitle>
                Approve the configuration above to create the agent.
              </ConfirmationTitle>
            </ConfirmationRequest>
            <ConfirmationActions>
              <ConfirmationAction
                onClick={() =>
                  addToolApprovalResponse({
                    id: approvalId,
                    approved: true,
                    reason: 'User approved agent creation.',
                  })
                }
                size="sm"
              >
                <CheckIcon className="size-4" />
                Create agent
              </ConfirmationAction>
              <ConfirmationAction
                onClick={() =>
                  addToolApprovalResponse({
                    id: approvalId,
                    approved: false,
                    reason: 'User denied agent creation and wants changes.',
                  })
                }
                size="sm"
                variant="outline"
              >
                <XIcon className="size-4" />
                Keep editing
              </ConfirmationAction>
            </ConfirmationActions>
          </Confirmation>
        </ToolContent>
      </Tool>
    )
  }

  if (part.state === 'approval-responded') {
    return (
      <Tool defaultOpen>
        <ToolHeader state={part.state} type={part.type} />
        <ToolContent>
          <Confirmation
            approval={part.approval as ConfirmationApproval}
            className="rounded-none border-2 border-foreground"
            state={part.state}
          >
            <ConfirmationAccepted>
              <ConfirmationTitle>
                <CheckIcon className="mr-2 inline size-4" />
                Approved — preparing the agent…
              </ConfirmationTitle>
            </ConfirmationAccepted>
            <ConfirmationRejected>
              <ConfirmationTitle>
                <XIcon className="mr-2 inline size-4" />
                Denied — keep editing.
              </ConfirmationTitle>
            </ConfirmationRejected>
          </Confirmation>
        </ToolContent>
      </Tool>
    )
  }

  if (part.state === 'output-available' && part.output) {
    return (
      <Tool defaultOpen>
        <ToolHeader state={part.state} type={part.type} />
        <ToolContent>
          <CreationSuccessCard result={part.output} />
        </ToolContent>
      </Tool>
    )
  }

  if (part.state === 'output-denied') {
    return (
      <Tool defaultOpen>
        <ToolHeader state={part.state} type={part.type} />
        <ToolContent>
          <Confirmation
            approval={part.approval as ConfirmationApproval}
            className="rounded-none border-2 border-foreground"
            state={part.state}
          >
            <ConfirmationRejected>
              <ConfirmationTitle>
                <XIcon className="mr-2 inline size-4" />
                Creation denied.
              </ConfirmationTitle>
            </ConfirmationRejected>
          </Confirmation>
        </ToolContent>
      </Tool>
    )
  }

  if (part.state === 'output-error') {
    return (
      <Tool defaultOpen>
        <ToolHeader state={part.state} type={part.type} />
        <ToolContent>
          <ToolOutput
            errorText={part.errorText ?? 'The agent was not created.'}
            output={undefined}
          />
        </ToolContent>
      </Tool>
    )
  }

  return null
}
