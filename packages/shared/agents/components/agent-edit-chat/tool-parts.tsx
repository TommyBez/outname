import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
} from '@outname/ai/components/ai-elements/confirmation'
import { MessageResponse } from '@outname/ai/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@outname/ai/components/ai-elements/reasoning'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from '@outname/ai/components/ai-elements/tool'
import type { AgentBudgetValues } from '@outname/shared/agents/components/agent-budget-values'
import type { ChatAddToolApproveResponseFunction, UIMessage } from 'ai'
import { CheckIcon, XIcon } from 'lucide-react'
import { BudgetApprovalPreview, ProposeBudgetCard } from './budget-preview'
import type { SendMessageFn } from './types'

const PROPOSE_BUDGET_PART_TYPE = 'tool-propose_agent_budget'
const TOOL_PREFIX_PATTERN = /^tool-/

export function MessagePartRenderer(input: {
  addToolApprovalResponse: ChatAddToolApproveResponseFunction
  currentBudget: AgentBudgetValues
  part: UIMessage['parts'][number]
  sendMessage: SendMessageFn
}) {
  const { part } = input
  if (part.type === 'text') {
    return <MessageResponse>{part.text}</MessageResponse>
  }
  if (part.type === 'reasoning') {
    return (
      <Reasoning isStreaming={part.state === 'streaming'}>
        <ReasoningTrigger />
        <ReasoningContent>{part.text}</ReasoningContent>
      </Reasoning>
    )
  }
  if (part.type === PROPOSE_BUDGET_PART_TYPE) {
    return (
      <ProposeBudgetCard
        currentBudget={input.currentBudget}
        part={part as ToolPart}
        sendMessage={input.sendMessage}
      />
    )
  }
  if (part.type === 'dynamic-tool') {
    return (
      <ToolCard
        addToolApprovalResponse={input.addToolApprovalResponse}
        currentBudget={input.currentBudget}
        part={part as ToolPart}
      />
    )
  }
  if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
    return (
      <ToolCard
        addToolApprovalResponse={input.addToolApprovalResponse}
        currentBudget={input.currentBudget}
        part={part as ToolPart}
      />
    )
  }
  return null
}

function ToolCard({
  part,
  addToolApprovalResponse,
  currentBudget,
}: {
  addToolApprovalResponse: ChatAddToolApproveResponseFunction
  currentBudget: AgentBudgetValues
  part: ToolPart
}) {
  const toolName = getToolPartName(part)
  const isApprovalRequest = part.state === 'approval-requested'
  const previewBody = renderApprovalPreview({
    currentBudget,
    input: part.input,
    isApprovalRequest,
    toolName,
  })

  return (
    <Tool>
      {part.type === 'dynamic-tool' ? (
        <ToolHeader
          state={part.state}
          toolName={(part as { toolName: string }).toolName}
          type="dynamic-tool"
        />
      ) : (
        <ToolHeader
          state={part.state}
          type={part.type as Exclude<ToolPart['type'], 'dynamic-tool'>}
        />
      )}
      <ToolContent>
        {previewBody}
        {part.state === 'approval-requested' ? (
          <Confirmation approval={part.approval} state={part.state}>
            <ConfirmationActions>
              <ConfirmationAction
                onClick={() =>
                  addToolApprovalResponse({
                    id: part.approval.id,
                    approved: true,
                    reason: 'User approved this edit operation.',
                  })
                }
              >
                <CheckIcon className="size-4" />
                Approve
              </ConfirmationAction>
              <ConfirmationAction
                onClick={() =>
                  addToolApprovalResponse({
                    id: part.approval.id,
                    approved: false,
                    reason: 'User denied this edit operation.',
                  })
                }
                variant="outline"
              >
                <XIcon className="size-4" />
                Deny
              </ConfirmationAction>
            </ConfirmationActions>
          </Confirmation>
        ) : null}
        {part.state === 'output-available' ? (
          <ToolOutput errorText={undefined} output={part.output} />
        ) : null}
        {part.state === 'output-error' ? (
          <ToolOutput errorText={part.errorText} output={undefined} />
        ) : null}
      </ToolContent>
    </Tool>
  )
}

function renderApprovalPreview(input: {
  currentBudget: AgentBudgetValues
  input: unknown
  isApprovalRequest: boolean
  toolName: string
}) {
  if (!input.isApprovalRequest) {
    return <ToolInput input={input.input} />
  }
  if (input.toolName === 'set_agent_budget') {
    return (
      <BudgetApprovalPreview
        currentBudget={input.currentBudget}
        input={input.input}
      />
    )
  }
  return <ToolInput input={input.input} />
}

function getToolPartName(part: ToolPart): string {
  if (part.type === 'dynamic-tool') {
    return (part as { toolName: string }).toolName
  }
  return part.type.replace(TOOL_PREFIX_PATTERN, '')
}
