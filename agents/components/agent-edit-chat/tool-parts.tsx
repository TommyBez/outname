import type { ChatAddToolApproveResponseFunction, UIMessage } from 'ai'
import { CheckIcon, XIcon } from 'lucide-react'
import type { AgentBudgetValues } from '@/agents/components/agent-budget-widget'
import { MessageResponse } from '@/components/ai-elements/message'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from '@/components/ai-elements/tool'
import { AgentEditApprovalPreview } from './approval-preview'
import { BudgetApprovalPreview, ProposeBudgetCard } from './budget-preview'
import type {
  AgentEditMarkdownFiles,
  AgentEditSettings,
  SendMessageFn,
} from './types'

const PROPOSE_BUDGET_PART_TYPE = 'tool-propose_agent_budget'
const TOOL_PREFIX_PATTERN = /^tool-/

export function renderMessagePart(input: {
  addToolApprovalResponse: ChatAddToolApproveResponseFunction
  currentBudget: AgentBudgetValues
  currentMarkdownFiles: AgentEditMarkdownFiles
  currentSettings: AgentEditSettings
  key: string
  part: UIMessage['parts'][number]
  sendMessage: SendMessageFn
}) {
  const { part, key } = input
  if (part.type === 'text') {
    return <MessageResponse key={key}>{part.text}</MessageResponse>
  }
  if (part.type === PROPOSE_BUDGET_PART_TYPE) {
    return (
      <ProposeBudgetCard
        currentBudget={input.currentBudget}
        key={key}
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
        currentMarkdownFiles={input.currentMarkdownFiles}
        currentSettings={input.currentSettings}
        key={key}
        part={part as ToolPart}
      />
    )
  }
  if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
    return (
      <ToolCard
        addToolApprovalResponse={input.addToolApprovalResponse}
        currentBudget={input.currentBudget}
        currentMarkdownFiles={input.currentMarkdownFiles}
        currentSettings={input.currentSettings}
        key={key}
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
  currentMarkdownFiles,
  currentSettings,
}: {
  addToolApprovalResponse: ChatAddToolApproveResponseFunction
  currentBudget: AgentBudgetValues
  currentMarkdownFiles: AgentEditMarkdownFiles
  currentSettings: AgentEditSettings
  part: ToolPart
}) {
  const toolName = getToolPartName(part)
  const isApprovalRequest = part.state === 'approval-requested'
  const previewBody = renderApprovalPreview({
    currentBudget,
    currentMarkdownFiles,
    currentSettings,
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
          <ToolApprovalActions
            approvalId={part.approval.id}
            onRespond={addToolApprovalResponse}
          />
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
  currentMarkdownFiles: AgentEditMarkdownFiles
  currentSettings: AgentEditSettings
  input: unknown
  isApprovalRequest: boolean
  toolName: string
}) {
  if (!input.isApprovalRequest) {
    return <ToolInput input={input.input} />
  }
  if (input.toolName === 'apply_agent_edit') {
    return (
      <AgentEditApprovalPreview
        currentMarkdownFiles={input.currentMarkdownFiles}
        currentSettings={input.currentSettings}
        input={input.input}
      />
    )
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

function ToolApprovalActions({
  approvalId,
  onRespond,
}: {
  approvalId: string
  onRespond: ChatAddToolApproveResponseFunction
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-2 border-foreground bg-muted p-3">
      <button
        className="inline-flex h-10 items-center justify-center gap-2 border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:bg-background hover:text-foreground"
        onClick={() =>
          onRespond({
            id: approvalId,
            approved: true,
            reason: 'User approved this edit operation.',
          })
        }
        type="button"
      >
        <CheckIcon className="size-4" />
        Approve
      </button>
      <button
        className="inline-flex h-10 items-center justify-center gap-2 border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-destructive hover:text-background"
        onClick={() =>
          onRespond({
            id: approvalId,
            approved: false,
            reason: 'User denied this edit operation.',
          })
        }
        type="button"
      >
        <XIcon className="size-4" />
        Deny
      </button>
    </div>
  )
}
