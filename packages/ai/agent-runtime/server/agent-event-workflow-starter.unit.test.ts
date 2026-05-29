import { describe, expect, it, vi } from 'vitest'

const { mockAgentEventWorkflow, mockStart } = vi.hoisted(() => ({
  mockAgentEventWorkflow: vi.fn(),
  mockStart: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('workflow/api', () => ({
  start: mockStart,
}))

vi.mock('@outname/ai/agent-runtime/workflows/events/workflow', () => ({
  agentEventWorkflow: mockAgentEventWorkflow,
}))

import { startAgentEventWorkflowRun } from './agent-event-workflow-starter'

describe('startAgentEventWorkflowRun', () => {
  it('starts agentEventWorkflow directly and returns the run id', async () => {
    mockStart.mockResolvedValue({ runId: 'wrun_child' })

    await expect(startAgentEventWorkflowRun('evt_child')).resolves.toBe(
      'wrun_child'
    )

    expect(mockStart).toHaveBeenCalledWith(mockAgentEventWorkflow, [
      { eventId: 'evt_child' },
    ])
  })
})
