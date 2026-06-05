import { describe, expect, it } from 'vitest'
import { account, session } from './auth'

describe('auth schema', () => {
  it('maps auth user foreign keys to snake_case database columns', () => {
    expect(session.userId.name).toBe('user_id')
    expect(account.userId.name).toBe('user_id')
  })
})
