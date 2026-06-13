import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockBuildAgent,
  mockCheckBudgetOrFinalize,
  mockCurrentWorkflowRunId,
  mockDidReachStepLimit,
  mockEmitActivity,
  mockBuildGenerationUsageObservations,
  mockGetWritable,
  mockInitRun,
  mockMarkBudgetSkippedRunCompletedStep,
  mockMarkRunCompletedStep,
  mockPersistAgentEventTranscriptStep,
  mockReadPreviousDreamingCompletionStep,
  mockReadPreviousHeartbeatCompletionStep,
  mockRecordTokenUsageStep,
  mockResolveStepLimit,
  mockReplaceAgentEventTranscriptMessagesBestEffortStep,
  mockStartupSystemSandboxStep,
  mockFinalizeRun,
} = vi.hoisted(() => ({
  mockBuildAgent: vi.fn(),
  mockBuildGenerationUsageObservations: vi.fn(),
  mockCheckBudgetOrFinalize: vi.fn(),
  mockCurrentWorkflowRunId: vi.fn(),
  mockDidReachStepLimit: vi.fn(),
  mockEmitActivity: vi.fn(),
  mockGetWritable: vi.fn(),
  mockInitRun: vi.fn(),
  mockMarkBudgetSkippedRunCompletedStep: vi.fn(),
  mockMarkRunCompletedStep: vi.fn(),
  mockPersistAgentEventTranscriptStep: vi.fn(),
  mockReadPreviousDreamingCompletionStep: vi.fn(),
  mockReadPreviousHeartbeatCompletionStep: vi.fn(),
  mockRecordTokenUsageStep: vi.fn(),
  mockResolveStepLimit: vi.fn(),
  mockReplaceAgentEventTranscriptMessagesBestEffortStep: vi.fn(),
  mockStartupSystemSandboxStep: vi.fn(),
  mockFinalizeRun: vi.fn(),
}))

vi.mock('@outname/workflow/runtime', () => ({
  getWritable: mockGetWritable,
}))

vi.mock('@outname/shared/server/workflow-run-id', () => ({
  currentWorkflowRunId: mockCurrentWorkflowRunId,
}))

vi.mock('@outname/ai/agent-runtime/server/run-events', () => ({
  emitActivity: mockEmitActivity,
}))

vi.mock('../agent-factory', () => ({
  buildAgent: mockBuildAgent,
  buildDreamingKickoff: vi.fn(() => 'dreaming kickoff'),
  buildHeartbeatKickoff: vi.fn(() => 'heartbeat kickoff'),
}))

vi.mock('../step-limit', () => ({
  didReachStepLimit: mockDidReachStepLimit,
  resolveStepLimit: mockResolveStepLimit,
  resolveStepLimitCount: vi.fn(() => 10),
}))

vi.mock('../steps/budget', () => ({
  buildGenerationUsageObservations: mockBuildGenerationUsageObservations,
  recordTokenUsageStep: mockRecordTokenUsageStep,
}))

vi.mock('../steps/db/agent-schedule', () => ({
  markBudgetSkippedRunCompletedStep: mockMarkBudgetSkippedRunCompletedStep,
  markRunCompletedStep: mockMarkRunCompletedStep,
  readPreviousDreamingCompletionStep: mockReadPreviousDreamingCompletionStep,
  readPreviousHeartbeatCompletionStep: mockReadPreviousHeartbeatCompletionStep,
}))

vi.mock('../steps/db/event-transcript-store', () => ({
  replaceAgentEventTranscriptMessagesBestEffortStep:
    mockReplaceAgentEventTranscriptMessagesBestEffortStep,
}))

vi.mock('../steps/db/system-sandbox', () => ({
  startupSystemSandboxStep: mockStartupSystemSandboxStep,
}))

vi.mock('../steps/finalize-run', () => ({
  finalizeRun: mockFinalizeRun,
}))

vi.mock('../steps/init-run', () => ({
  initRun: mockInitRun,
}))

vi.mock('../steps/persist-event-transcript', () => ({
  persistAgentEventTranscriptStep: mockPersistAgentEventTranscriptStep,
}))

vi.mock('./handle-heartbeat/budget', () => ({
  checkBudgetOrFinalize: mockCheckBudgetOrFinalize,
}))

import { handleHeartbeat } from './handle-heartbeat'

describe('handleHeartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentWorkflowRunId.mockReturnValue('wrun_123')
    mockCheckBudgetOrFinalize.mockResolvedValue({
      agentRow: {
        id: 'agent_123',
        userId: 'user_123',
      },
      kind: 'continue',
      userId: 'user_123',
    })
    mockReadPreviousHeartbeatCompletionStep.mockResolvedValue(null)
    mockReadPreviousDreamingCompletionStep.mockResolvedValue(null)
    mockGetWritable.mockReturnValue({
      close: vi.fn().mockResolvedValue(undefined),
      getWriter: () => ({
        releaseLock: vi.fn(),
        write: vi.fn().mockResolvedValue(undefined),
      }),
    })
    mockResolveStepLimit.mockReturnValue('stop-when')
    mockDidReachStepLimit.mockReturnValue(false)
    mockBuildGenerationUsageObservations.mockReturnValue([])
    mockBuildAgent.mockResolvedValue({
      agent: {
        stream: vi.fn().mockResolvedValue({ steps: [] }),
      },
      meta: {
        inferenceProvider: 'vercel-ai-gateway',
        model: 'test-model',
        name: 'Test Agent',
        stepLimitCustom: null,
        stepLimitMode: 'default',
        userId: 'user_123',
      },
    })
  })

  it('passes the output namespace to buildAgent so workflow subagents can stream back to the parent', async () => {
    const buildSubAgentTool = vi.fn()

    await handleHeartbeat({
      agentId: 'agent_123',
      buildSubAgentTool,
      eventId: 'evt_123',
      replyToken: 'reply:evt_123',
      userId: 'user_123',
    })

    expect(mockBuildAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'agent_123',
        buildSubAgentTool,
        currentRunId: 'wrun_123',
        runId: 'wrun_123',
        streamNamespace: 'reply:evt_123',
      })
    )
  })
})
