export const BOTID_CHECK_LEVEL = 'basic' as const

export const BOTID_PROTECTED_ROUTES = [
  {
    path: '/api/auth/request-otp',
    method: 'POST',
    advancedOptions: { checkLevel: BOTID_CHECK_LEVEL },
  },
  {
    path: '/api/auth/*',
    method: 'POST',
    advancedOptions: { checkLevel: BOTID_CHECK_LEVEL },
  },
  {
    path: '/api/waitlist',
    method: 'POST',
    advancedOptions: { checkLevel: BOTID_CHECK_LEVEL },
  },
  {
    path: '/api/waitlist/confirm',
    method: 'POST',
    advancedOptions: { checkLevel: BOTID_CHECK_LEVEL },
  },
] as const
