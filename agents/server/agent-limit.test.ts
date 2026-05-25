import { describe, expect, it } from 'vitest'
import {
  AgentLimitReachedError,
  MAX_AGENTS_PER_USER,
} from '@/agents/shared/agent-limit-types'

describe('agent limit', () => {
  it('exposes a limit of three agents for non-admin users', () => {
    expect(MAX_AGENTS_PER_USER).toBe(3)
  })

  it('formats agent limit errors for clients', () => {
    const error = new AgentLimitReachedError(3, 3)
    expect(error.code).toBe('AGENT_LIMIT_REACHED')
    expect(error.message).toContain('3')
  })
})
