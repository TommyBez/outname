import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  composeSystemPrompt: vi.fn(),
  loadAgentStep: vi.fn(),
  resolveSkillPlan: vi.fn(),
  resolveToolPlan: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock(
  '@outname/ai/agent-runtime/workflows/session/steps/db/load-agent',
  () => ({
    loadAgentStep: mocks.loadAgentStep,
  })
)

vi.mock(
  '@outname/ai/agent-runtime/workflows/session/compose-system-prompt',
  () => ({
    composeSystemPrompt: mocks.composeSystemPrompt,
  })
)

vi.mock(
  '@outname/ai/agent-runtime/workflows/session/steps/resolve-tool-plan',
  () => ({
    resolveToolPlan: mocks.resolveToolPlan,
  })
)

vi.mock(
  '@outname/ai/agent-runtime/workflows/session/steps/resolve-skill-plan',
  () => ({
    resolveSkillPlan: mocks.resolveSkillPlan,
  })
)

describe('buildAgentRuntimeSpec', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
    const skillPlan = {
      sandboxName: 'agent-agent_123-skills',
      skills: [
        {
          description: 'Stress-test a plan against project docs.',
          name: 'Grill With Docs',
          nameNormalized: 'grill with docs',
          path: '/vercel/sandbox/skills/grill-with-docs',
          skillMdPath: '/vercel/sandbox/skills/grill-with-docs/SKILL.md',
          slug: 'grill-with-docs',
        },
      ],
    }
    mocks.loadAgentStep.mockResolvedValue({
      inferenceProvider: 'vercel-ai-gateway',
      id: 'agent_123',
      model: 'openai/gpt-5.1',
      name: 'Main Agent',
      stepLimitCustom: null,
      stepLimitMode: 'medium',
      userId: 'user_123',
    })
    mocks.resolveToolPlan.mockResolvedValue(toolPlan)
    mocks.resolveSkillPlan.mockResolvedValue(skillPlan)
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
      inferenceProvider: 'vercel-ai-gateway',
      modelId: 'openai/gpt-5.1',
      skillPlan,
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
      hasSkillTools: true,
      nowIso: '2026-05-21T10:00:00.000Z',
      reconnects: [],
    })
  })
})
