import type { BuildAgentTool } from '@outname/ai/tools/sub-agents/agent-tool'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockBuildAgentRuntimeSpec,
  mockBuildRuntimeToolset,
  mockReadUserInferenceCredentialApiKey,
  mockWorkflowAgent,
} = vi.hoisted(() => ({
  mockBuildAgentRuntimeSpec: vi.fn(),
  mockBuildRuntimeToolset: vi.fn(),
  mockReadUserInferenceCredentialApiKey: vi.fn(),
  mockWorkflowAgent: vi.fn(function WorkflowAgent(options: unknown) {
    return { options }
  }),
}))

vi.mock('@ai-sdk/workflow', () => ({
  WorkflowAgent: mockWorkflowAgent,
}))

vi.mock('@outname/ai/agent-runtime/server/runtime-spec', () => ({
  buildAgentRuntimeSpec: mockBuildAgentRuntimeSpec,
}))

vi.mock('@outname/ai/agent-runtime/server/runtime-toolset', () => ({
  buildRuntimeToolset: mockBuildRuntimeToolset,
}))

vi.mock('@outname/shared/server/inference-credentials', () => ({
  readUserInferenceCredentialApiKey: mockReadUserInferenceCredentialApiKey,
}))

vi.mock('@outname/shared/server/inference-provider-errors', () => ({
  MissingInferenceCredentialError: class MissingInferenceCredentialError extends Error {},
}))

vi.mock('@outname/shared/server/workflow-step-errors', () => ({
  nonRetryableStepErrorFromUnknown: vi.fn((error) => error),
}))

import { buildAgent } from './agent-factory'

describe('buildAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBuildAgentRuntimeSpec.mockResolvedValue(createRuntimeSpec())
    mockBuildRuntimeToolset.mockReturnValue({
      testTool: { description: 'test' },
    })
    mockReadUserInferenceCredentialApiKey.mockResolvedValue('vck_test')
  })

  it('uses a serializable AI Gateway model id plus request headers for workflow model calls', async () => {
    const result = await buildAgent({
      agentId: 'agent_123',
      buildSubAgentTool: vi.fn() as unknown as BuildAgentTool,
      runId: 'wrun_123',
    })

    expect(mockWorkflowAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: 'system prompt',
        model: 'anthropic/claude-haiku-4.5',
      })
    )
    expect(result.modelCallHeaders).toEqual({
      Authorization: 'Bearer vck_test',
      'ai-gateway-auth-method': 'api-key',
      'ai-gateway-protocol-version': '0.0.1',
    })
  })

  it('rejects non-Gateway providers before building the workflow agent runtime', async () => {
    mockBuildAgentRuntimeSpec.mockResolvedValue(
      createRuntimeSpec({ inferenceProvider: 'openrouter' })
    )

    await expect(
      buildAgent({
        agentId: 'agent_123',
        buildSubAgentTool: vi.fn() as unknown as BuildAgentTool,
        runId: 'wrun_123',
      })
    ).rejects.toThrow(
      'Workflow agent runs require vercel-ai-gateway; this agent is configured for openrouter.'
    )

    expect(mockBuildRuntimeToolset).not.toHaveBeenCalled()
    expect(mockReadUserInferenceCredentialApiKey).not.toHaveBeenCalled()
    expect(mockWorkflowAgent).not.toHaveBeenCalled()
  })
})

function createRuntimeSpec(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    agentId: 'agent_123',
    agentName: 'Test Agent',
    callStack: [],
    depth: 0,
    eventKind: 'heartbeat',
    inferenceProvider: 'vercel-ai-gateway',
    modelId: 'anthropic/claude-haiku-4.5',
    skillPlan: { skills: [] },
    stepLimitCustom: null,
    stepLimitMode: 'medium',
    systemPrompt: 'system prompt',
    toolPlan: { tools: [] },
    userId: 'user_123',
    ...overrides,
  }
}
