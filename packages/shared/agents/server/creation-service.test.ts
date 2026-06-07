import { createHash } from 'node:crypto'
import type { Agent } from '@outname/db/schema'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockDbInsert,
  mockDbSelect,
  mockHasEnabledInferenceProvider,
  mockIsModelSelectionValid,
  mockRefreshAgentCapabilitySummary,
  mockWriteBootstrapFiles,
} = vi.hoisted(() => ({
  mockDbInsert: vi.fn(),
  mockDbSelect: vi.fn(),
  mockHasEnabledInferenceProvider: vi.fn(),
  mockIsModelSelectionValid: vi.fn(),
  mockRefreshAgentCapabilitySummary: vi.fn(),
  mockWriteBootstrapFiles: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/db', () => ({
  db: {
    insert: mockDbInsert,
    select: mockDbSelect,
  },
}))

vi.mock('@outname/shared/agents/server/bootstrap-files', () => ({
  writeBootstrapFiles: mockWriteBootstrapFiles,
}))

vi.mock('@outname/shared/agents/server/capability-summary', () => ({
  refreshAgentCapabilitySummary: mockRefreshAgentCapabilitySummary,
}))

vi.mock('@outname/shared/server/inference-models', () => ({
  DEFAULT_MODEL_BY_PROVIDER: {
    'llm-gateway': 'gpt-5-mini',
    openrouter: 'openai/gpt-5-mini',
    'vercel-ai-gateway': 'openai/gpt-5-mini',
  },
  isModelSelectionValid: mockIsModelSelectionValid,
}))

vi.mock('@outname/shared/server/inference-providers', () => ({
  hasEnabledInferenceProvider: mockHasEnabledInferenceProvider,
}))

import {
  AgentCreationLimitExceededError,
  type CreateAgentInput,
  createAgentForUser,
  NON_ADMIN_AGENT_LIMIT,
} from './creation-service'

describe('createAgentForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasEnabledInferenceProvider.mockResolvedValue(true)
    mockIsModelSelectionValid.mockResolvedValue(true)
    mockRefreshAgentCapabilitySummary.mockResolvedValue(undefined)
    mockWriteBootstrapFiles.mockResolvedValue(undefined)
  })

  it('blocks non-admin users once they already have three agents', async () => {
    queueSelectWithLimit([{ role: 'user' }])
    queueSelectWithWhere([{ total: NON_ADMIN_AGENT_LIMIT }])

    await expect(createAgentForUser(createInput())).rejects.toThrow(
      AgentCreationLimitExceededError
    )

    expect(mockDbInsert).not.toHaveBeenCalled()
    expect(mockWriteBootstrapFiles).not.toHaveBeenCalled()
    expect(mockRefreshAgentCapabilitySummary).not.toHaveBeenCalled()
  })

  it('allows non-admin users below the three-agent limit', async () => {
    const createdAgent = agentRow({ id: 'ag_created' })
    queueSelectWithLimit([{ role: 'user' }])
    queueSelectWithWhere([{ total: NON_ADMIN_AGENT_LIMIT - 1 }])
    mockInsertReturning([createdAgent])

    await expect(createAgentForUser(createInput())).resolves.toMatchObject({
      agent: createdAgent,
      created: true,
    })

    expect(mockDbInsert).toHaveBeenCalledOnce()
    expect(mockWriteBootstrapFiles).toHaveBeenCalledOnce()
    expect(mockRefreshAgentCapabilitySummary).toHaveBeenCalledOnce()
  })

  it('does not apply the limit to admin users', async () => {
    const createdAgent = agentRow({ id: 'ag_admin' })
    queueSelectWithLimit([{ role: 'admin' }])
    mockInsertReturning([createdAgent])

    await expect(createAgentForUser(createInput())).resolves.toMatchObject({
      agent: createdAgent,
      created: true,
    })

    expect(mockDbSelect).toHaveBeenCalledTimes(1)
    expect(mockDbInsert).toHaveBeenCalledOnce()
  })

  it('allows idempotent creation retries for an existing agent at the limit', async () => {
    const input = createInput({ idempotencyKey: 'tool_call_123' })
    const existingAgent = agentRow({
      id: stableAgentIdForCreation({
        idempotencyKey: input.idempotencyKey ?? '',
        userId: input.userId,
      }),
    })
    queueSelectWithLimit([existingAgent])

    await expect(createAgentForUser(input)).resolves.toMatchObject({
      agent: existingAgent,
      created: false,
      id: existingAgent.id,
    })

    expect(mockDbSelect).toHaveBeenCalledTimes(1)
    expect(mockDbInsert).not.toHaveBeenCalled()
    expect(mockWriteBootstrapFiles).toHaveBeenCalledOnce()
    expect(mockRefreshAgentCapabilitySummary).toHaveBeenCalledOnce()
  })
})

function createInput(
  overrides: Partial<CreateAgentInput> = {}
): CreateAgentInput {
  return {
    dreamingEnabled: true,
    heartbeatEnabled: true,
    heartbeatIntervalMinutes: 30,
    heartbeatScheduleMode: 'interval',
    heartbeatScheduleTimes: [],
    identityCard: 'You are Test Agent.',
    inferenceProvider: 'vercel-ai-gateway',
    instructions: '# Instructions',
    model: 'openai/gpt-5-mini',
    name: 'Test Agent',
    soul: '# Soul',
    stepLimitCustom: null,
    stepLimitMode: 'medium',
    userId: 'user_123',
    userProfile: '',
    ...overrides,
  }
}

function agentRow(overrides: Partial<Agent> = {}): Agent {
  return {
    capabilitySummary: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    dreamingEnabled: true,
    enabled: true,
    heartbeatEnabled: true,
    heartbeatIntervalMinutes: 30,
    heartbeatScheduleMode: 'interval',
    heartbeatScheduleTimes: [],
    id: 'ag_123',
    inferenceProvider: 'vercel-ai-gateway',
    lastDreamingAt: null,
    lastDreamingLocalDate: null,
    lastHeartbeatAt: null,
    model: 'openai/gpt-5-mini',
    name: 'Test Agent',
    sandboxSkillsId: null,
    sandboxSystemId: null,
    stepLimitCustom: null,
    stepLimitMode: 'medium',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    userId: 'user_123',
    ...overrides,
  }
}

function mockInsertReturning(rows: Agent[]): void {
  const returning = vi.fn().mockResolvedValue(rows)
  const onConflictDoNothing = vi.fn(() => ({ returning }))
  const values = vi.fn(() => ({ onConflictDoNothing }))
  mockDbInsert.mockReturnValue({ values })
}

function queueSelectWithLimit(rows: unknown[]): void {
  const limit = vi.fn().mockResolvedValue(rows)
  const where = vi.fn(() => ({ limit }))
  const from = vi.fn(() => ({ where }))
  mockDbSelect.mockImplementationOnce(() => ({ from }))
}

function queueSelectWithWhere(rows: unknown[]): void {
  const where = vi.fn().mockResolvedValue(rows)
  const from = vi.fn(() => ({ where }))
  mockDbSelect.mockImplementationOnce(() => ({ from }))
}

function stableAgentIdForCreation(input: {
  idempotencyKey: string
  userId: string
}): string {
  const hash = createHash('sha256')
    .update(`${input.userId}:${input.idempotencyKey}`)
    .digest('hex')
    .slice(0, 24)
  return `ag_${hash}`
}
