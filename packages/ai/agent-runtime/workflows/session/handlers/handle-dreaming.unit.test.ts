import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAppendDreamDiaryStep,
  mockBeginDreamingSweepStep,
  mockCheckBudgetOrFinalize,
  mockCompleteDreamingSweepStep,
  mockCurrentWorkflowRunId,
  mockEmitActivity,
  mockFailDreamingSweepStep,
  mockFinalizeRun,
  mockInitRun,
  mockMarkRunCompletedStep,
  mockRecordTokenUsageStep,
  mockReplaceAgentEventTranscriptMessagesBestEffortStep,
  mockRunDeepPhaseStep,
  mockRunDiaryNarrativeStep,
  mockRunLightPhaseStep,
  mockRunRemPhaseStep,
  mockStartupSystemSandboxStep,
} = vi.hoisted(() => ({
  mockAppendDreamDiaryStep: vi.fn(),
  mockBeginDreamingSweepStep: vi.fn(),
  mockCheckBudgetOrFinalize: vi.fn(),
  mockCompleteDreamingSweepStep: vi.fn(),
  mockCurrentWorkflowRunId: vi.fn(),
  mockEmitActivity: vi.fn(),
  mockFailDreamingSweepStep: vi.fn(),
  mockFinalizeRun: vi.fn(),
  mockInitRun: vi.fn(),
  mockMarkRunCompletedStep: vi.fn(),
  mockRecordTokenUsageStep: vi.fn(),
  mockReplaceAgentEventTranscriptMessagesBestEffortStep: vi.fn(),
  mockRunDeepPhaseStep: vi.fn(),
  mockRunDiaryNarrativeStep: vi.fn(),
  mockRunLightPhaseStep: vi.fn(),
  mockRunRemPhaseStep: vi.fn(),
  mockStartupSystemSandboxStep: vi.fn(),
}))

vi.mock('@outname/shared/server/workflow-run-id', () => ({
  currentWorkflowRunId: mockCurrentWorkflowRunId,
}))

vi.mock('@outname/ai/agent-runtime/server/run-events', () => ({
  emitActivity: mockEmitActivity,
}))

vi.mock('../steps/db/agent-schedule', () => ({
  markRunCompletedStep: mockMarkRunCompletedStep,
}))

vi.mock('../steps/db/event-transcript-store', () => ({
  replaceAgentEventTranscriptMessagesBestEffortStep:
    mockReplaceAgentEventTranscriptMessagesBestEffortStep,
}))

vi.mock('../steps/db/system-sandbox', () => ({
  startupSystemSandboxStep: mockStartupSystemSandboxStep,
}))

vi.mock('../steps/dreaming/dreaming-steps', () => ({
  appendDreamDiaryStep: mockAppendDreamDiaryStep,
  beginDreamingSweepStep: mockBeginDreamingSweepStep,
  completeDreamingSweepStep: mockCompleteDreamingSweepStep,
  failDreamingSweepStep: mockFailDreamingSweepStep,
  runDeepPhaseStep: mockRunDeepPhaseStep,
  runDiaryNarrativeStep: mockRunDiaryNarrativeStep,
  runLightPhaseStep: mockRunLightPhaseStep,
  runRemPhaseStep: mockRunRemPhaseStep,
}))

vi.mock('../steps/finalize-run', () => ({
  finalizeRun: mockFinalizeRun,
}))

vi.mock('../steps/init-run', () => ({
  initRun: mockInitRun,
}))

vi.mock('../steps/budget', () => ({
  recordTokenUsageStep: mockRecordTokenUsageStep,
}))

vi.mock('./handle-heartbeat/budget', () => ({
  checkBudgetOrFinalize: mockCheckBudgetOrFinalize,
}))

import { handleDreaming } from './handle-dreaming'

const baseInput = {
  agentId: 'agent_123',
  attempt: 2,
  eventId: 'evt_123',
  localDate: '2026-06-08',
  manual: false,
  scheduledAt: '2026-06-08T03:00:00.000Z',
  userId: 'user_123',
}

describe('handleDreaming', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentWorkflowRunId.mockReturnValue('wrun_123')
    mockCheckBudgetOrFinalize.mockResolvedValue({
      kind: 'continue',
      userId: 'user_123',
    })
    mockRunLightPhaseStep.mockResolvedValue({
      candidatesConsidered: 2,
      evidenceSnippets: 3,
      phase: 'light',
      signalsWritten: 1,
    })
    mockRunRemPhaseStep.mockResolvedValue({
      candidatesConsidered: 2,
      evidenceSnippets: 0,
      phase: 'rem',
      signalsWritten: 2,
    })
    mockRunDeepPhaseStep.mockResolvedValue({
      candidatesConsidered: 1,
      evidenceSnippets: 0,
      phase: 'deep',
      promotions: [],
      signalsWritten: 1,
    })
    mockRunDiaryNarrativeStep.mockResolvedValue(null)
  })

  it('budget skips before sandbox or store startup', async () => {
    mockCheckBudgetOrFinalize.mockResolvedValue({
      kind: 'exceeded',
      message: 'Budget exceeded',
    })

    await handleDreaming(baseInput)

    expect(mockStartupSystemSandboxStep).not.toHaveBeenCalled()
    expect(mockBeginDreamingSweepStep).not.toHaveBeenCalled()
    expect(
      mockReplaceAgentEventTranscriptMessagesBestEffortStep
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_123',
        userId: 'user_123',
      })
    )
    expect(mockMarkRunCompletedStep).not.toHaveBeenCalled()
  })

  it('runs deterministic phases and marks the dreaming local date complete', async () => {
    await handleDreaming(baseInput)

    expect(mockBeginDreamingSweepStep).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 2,
        eventId: 'evt_123',
        sweepId: 'sweep_evt_123',
      })
    )
    expect(mockRunLightPhaseStep).toHaveBeenCalled()
    expect(mockRunRemPhaseStep).toHaveBeenCalled()
    expect(mockRunDeepPhaseStep).toHaveBeenCalled()
    expect(mockAppendDreamDiaryStep).toHaveBeenCalled()
    expect(mockCompleteDreamingSweepStep).toHaveBeenCalledWith(
      expect.objectContaining({ sweepId: 'sweep_evt_123' })
    )
    expect(mockMarkRunCompletedStep).toHaveBeenCalledWith({
      agentId: 'agent_123',
      localDate: '2026-06-08',
      mode: 'dreaming',
    })
    expect(mockFinalizeRun).toHaveBeenCalledWith(
      'wrun_123',
      'completed',
      'Dreaming complete'
    )
  })

  it('fails the sweep and does not mark the local date when a required phase fails', async () => {
    mockRunRemPhaseStep.mockRejectedValue(new Error('REM exploded'))

    await expect(handleDreaming(baseInput)).rejects.toThrow('REM exploded')

    expect(mockFailDreamingSweepStep).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'REM exploded',
        sweepId: 'sweep_evt_123',
      })
    )
    expect(mockMarkRunCompletedStep).not.toHaveBeenCalled()
    expect(mockFinalizeRun).toHaveBeenCalledWith(
      'wrun_123',
      'failed',
      'REM exploded'
    )
  })
})
