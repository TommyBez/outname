export const BOTID_CHECK_LEVEL = 'basic' as const

export const BOTID_PROTECTED_ROUTES = [
  {
    path: '/api/auth/email-otp/send-verification-otp',
    method: 'POST',
    advancedOptions: { checkLevel: BOTID_CHECK_LEVEL },
  },
  {
    path: '/api/auth/*',
    method: 'POST',
    advancedOptions: { checkLevel: BOTID_CHECK_LEVEL },
  },
] as const
