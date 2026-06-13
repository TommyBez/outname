import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAsc,
  mockDbFrom,
  mockDbOrderBy,
  mockDbSelect,
  mockDbWhere,
  mockEq,
} = vi.hoisted(() => ({
  mockAsc: vi.fn((column) => ({ column, type: 'asc' })),
  mockDbFrom: vi.fn(),
  mockDbOrderBy: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbWhere: vi.fn(),
  mockEq: vi.fn((column, value) => ({ column, type: 'eq', value })),
}))

vi.mock('server-only', () => ({}))

vi.mock('drizzle-orm', () => ({
  asc: mockAsc,
  eq: mockEq,
}))

vi.mock('@outname/db', () => ({
  db: {
    select: mockDbSelect,
  },
}))

vi.mock('@outname/db/schema', () => ({
  user: {
    email: 'user.email',
    role: 'user.role',
  },
}))

import { listWaitlistAdminEmails } from './admin-email-config'

describe('waitlist admin email config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbSelect.mockReturnValue({ from: mockDbFrom })
    mockDbFrom.mockReturnValue({ where: mockDbWhere })
    mockDbWhere.mockReturnValue({ orderBy: mockDbOrderBy })
  })

  it('lists distinct emails for users with the admin role', async () => {
    mockDbOrderBy.mockResolvedValue([
      { email: 'admin-a@example.com' },
      { email: 'admin-b@example.com' },
      { email: 'admin-a@example.com' },
      { email: '   ' },
    ])

    await expect(listWaitlistAdminEmails()).resolves.toEqual([
      'admin-a@example.com',
      'admin-b@example.com',
    ])
    expect(mockDbSelect).toHaveBeenCalledWith({ email: 'user.email' })
    expect(mockEq).toHaveBeenCalledWith('user.role', 'admin')
    expect(mockAsc).toHaveBeenCalledWith('user.email')
  })
})
