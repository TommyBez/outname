import type { ChatAddToolApproveResponseFunction, UIMessage } from 'ai'
import { CheckIcon, XIcon } from 'lucide-react'
import type { AgentBudgetValues } from '@/agents/components/agent-budget-widget'
import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
} from '@/components/ai-elements/confirmation'
import { MessageResponse } from '@/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from '@/components/ai-elements/tool'
import { BudgetApprovalPreview, ProposeBudgetCard } from './budget-preview'
import type { SendMessageFn } from './types'

const PROPOSE_BUDGET_PART_TYPE = 'tool-propose_agent_budget'
const TOOL_PREFIX_PATTERN = /^tool-/

export function renderMessagePart(input: {
  addToolApprovalResponse: ChatAddToolApproveResponseFunction
  currentBudget: AgentBudgetValues
  key: string
  part: UIMessage['parts'][number]
  requireAiGatewayKey: () => boolean
  sendMessage: SendMessageFn
}) {
  const { part, key } = input
  if (part.type === 'text') {
    return <MessageResponse key={key}>{part.text}</MessageResponse>
  }
  if (part.type === 'reasoning') {
    return (
      <Reasoning isStreaming={part.state === 'streaming'} key={key}>
        <ReasoningTrigger />
        <ReasoningContent>{part.text}</ReasoningContent>
      </Reasoning>
    )
  }
  if (part.type === PROPOSE_BUDGET_PART_TYPE) {
    return (
      <ProposeBudgetCard
        currentBudget={input.currentBudget}
        key={key}
        part={part as ToolPart}
        requireAiGatewayKey={input.requireAiGatewayKey}
        sendMessage={input.sendMessage}
      />
    )
  }
  if (part.type === 'dynamic-tool') {
    return (
      <ToolCard
        addToolApprovalResponse={input.addToolApprovalResponse}
        currentBudget={input.currentBudget}
        key={key}
        part={part as ToolPart}
        requireAiGatewayKey={input.requireAiGatewayKey}
      />
    )
  }
  if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
    return (
      <ToolCard
        addToolApprovalResponse={input.addToolApprovalResponse}
        currentBudget={input.currentBudget}
        key={key}
        part={part as ToolPart}
        requireAiGatewayKey={input.requireAiGatewayKey}
      />
    )
  }
  return null
}

function ToolCard({
  part,
  addToolApprovalResponse,
  currentBudget,
  requireAiGatewayKey,
}: {
  addToolApprovalResponse: ChatAddToolApproveResponseFunction
  currentBudget: AgentBudgetValues
  part: ToolPart
  requireAiGatewayKey: () => boolean
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
                onClick={() => {
                  if (!requireAiGatewayKey()) {
                    return
                  }
                  addToolApprovalResponse({
                    id: part.approval.id,
                    approved: true,
                    reason: 'User approved this edit operation.',
                  })
                }}
              >
                <CheckIcon className="size-4" />
                Approve
              </ConfirmationAction>
              <ConfirmationAction
                onClick={() => {
                  if (!requireAiGatewayKey()) {
                    return
                  }
                  addToolApprovalResponse({
                    id: part.approval.id,
                    approved: false,
                    reason: 'User denied this edit operation.',
                  })
                }}
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
