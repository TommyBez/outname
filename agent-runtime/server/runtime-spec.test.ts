import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  composeSystemPrompt: vi.fn(),
  getAgentById: vi.fn(),
  resolveToolPlan: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/agent-runtime/server/start-agent-run', () => ({
  getAgentById: mocks.getAgentById,
}))

vi.mock('@/agent-runtime/workflows/session/compose-system-prompt', () => ({
  composeSystemPrompt: mocks.composeSystemPrompt,
}))

vi.mock('@/agent-runtime/workflows/session/steps/resolve-tool-plan', () => ({
  resolveToolPlan: mocks.resolveToolPlan,
}))

describe('buildAgentRuntimeSpec', () => {
  it('returns a JSON-serializable runtime spec outside workflow context', async () => {
    const toolPlan = {
      planned: [
        {
          config: { path: '/tmp/work' },
          connectorRequirements: [],
          toolConfig: { mode: 'read' },
          toolId: 'repo_workspace',
        },
      ],
      reconnects: [],
      subAgents: [
        {
          childAgentId: 'agent_child',
          childCapabilitySummary: 'Writes concise summaries',
          childName: 'Summarizer',
          childUserId: 'user_123',
          rowToolId: 'tool_row_123',
          toolId: 'agent_summarizer',
        },
      ],
    }
    mocks.getAgentById.mockResolvedValue({
      id: 'agent_123',
      model: 'openai/gpt-5.1',
      name: 'Main Agent',
      stepLimitCustom: null,
      stepLimitMode: 'medium',
      userId: 'user_123',
    })
    mocks.resolveToolPlan.mockResolvedValue(toolPlan)
    mocks.composeSystemPrompt.mockResolvedValue('You are Main Agent.')

    const { buildAgentRuntimeSpec } = await import('./runtime-spec')
    const spec = await buildAgentRuntimeSpec({
      agentId: 'agent_123',
      callStack: ['agent_root'],
      depth: 1,
      eventKind: 'chat',
      nowIso: '2026-05-21T10:00:00.000Z',
      runId: 'rt_123',
    })

    expect(spec).toEqual({
      agentId: 'agent_123',
      agentName: 'Main Agent',
      callStack: ['agent_root'],
      depth: 1,
      eventKind: 'chat',
      modelId: 'openai/gpt-5.1',
      stepLimitCustom: null,
      stepLimitMode: 'medium',
      systemPrompt: 'You are Main Agent.',
      toolPlan,
      userId: 'user_123',
    })
    expect(JSON.parse(JSON.stringify(spec))).toEqual(spec)
    expect(mocks.resolveToolPlan).toHaveBeenCalledWith({
      agentId: 'agent_123',
      callStack: ['agent_root'],
      depth: 1,
      userId: 'user_123',
    })
    expect(mocks.composeSystemPrompt).toHaveBeenCalledWith({
      agentId: 'agent_123',
      agentName: 'Main Agent',
      eventKind: 'chat',
      nowIso: '2026-05-21T10:00:00.000Z',
      reconnects: [],
    })
  })
})
