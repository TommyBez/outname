import 'server-only'

import { sendAuthNewUserWelcomeEmail } from '@outname/auth/server/auth-email'

interface CreatedAuthUser {
  email: string
  id: string
}

function isCreatedAuthUser(value: unknown): value is CreatedAuthUser {
  if (!(value && typeof value === 'object')) {
    return false
  }

  return (
    'email' in value &&
    typeof value.email === 'string' &&
    'id' in value &&
    typeof value.id === 'string'
  )
}

export async function sendWelcomeEmailForCreatedUser(user: unknown) {
  if (!isCreatedAuthUser(user)) {
    return
  }

  try {
    await sendAuthNewUserWelcomeEmail({
      email: user.email,
      userId: user.id,
    })
  } catch (error) {
    console.error('[auth] welcome email failed', error)
  }
}
