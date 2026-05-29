'use client'

import { adminClient, emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { ac, roles } from '@/auth/access-control'

const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac,
      roles,
    }),
    emailOTPClient(),
  ],
})
export const { signIn, signOut } = authClient
