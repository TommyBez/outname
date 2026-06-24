'use client'

import { ac, roles } from '@outname/auth/access-control'
import { adminClient, emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

const authClient = createAuthClient({
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [
    adminClient({
      ac,
      roles,
    }),
    emailOTPClient(),
  ],
})
export const { emailOtp, signIn, signOut } = authClient
