import { beforeEach, expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@outname/auth/server/auth-email', () => ({
  sendAuthNewUserWelcomeEmail: vi.fn(),
}))

import { sendAuthNewUserWelcomeEmail } from '@outname/auth/server/auth-email'
import { sendWelcomeEmailForCreatedUser } from './user-welcome-email-hook'

const mockedSendWelcomeEmail = vi.mocked(sendAuthNewUserWelcomeEmail)

beforeEach(() => {
  vi.clearAllMocks()
})

test('sends a welcome email for a newly created user', async () => {
  await sendWelcomeEmailForCreatedUser({
    email: 'new-user@example.com',
    id: 'user_123',
  })

  expect(mockedSendWelcomeEmail).toHaveBeenCalledWith({
    email: 'new-user@example.com',
    userId: 'user_123',
  })
})

test('ignores malformed created user payloads', async () => {
  await sendWelcomeEmailForCreatedUser({ email: 'missing-id@example.com' })
  await sendWelcomeEmailForCreatedUser(null)

  expect(mockedSendWelcomeEmail).not.toHaveBeenCalled()
})

test('does not fail signup when welcome email sending fails', async () => {
  const consoleError = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined)
  try {
    mockedSendWelcomeEmail.mockRejectedValueOnce(new Error('send failed'))

    await expect(
      sendWelcomeEmailForCreatedUser({
        email: 'new-user@example.com',
        id: 'user_123',
      })
    ).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalled()
  } finally {
    consoleError.mockRestore()
  }
})
