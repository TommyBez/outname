export const MAX_AGENTS_PER_USER = 3

export interface AgentCreationLimitState {
  canCreate: boolean
  count: number
  isAdmin: boolean
  limit: number
}

export class AgentLimitReachedError extends Error {
  readonly code = 'AGENT_LIMIT_REACHED'
  readonly limit: number
  readonly currentCount: number

  constructor(limit: number, currentCount: number) {
    super(
      `You can create at most ${limit} agents. You currently have ${currentCount}.`
    )
    this.name = 'AgentLimitReachedError'
    this.limit = limit
    this.currentCount = currentCount
  }
}
