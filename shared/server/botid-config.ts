export const BOTID_PROTECTED_ROUTES = [
  { path: '/api/auth/request-otp', method: 'POST' },
  { path: '/api/auth/*', method: 'POST' },
  { path: '/api/waitlist', method: 'POST' },
  { path: '/api/waitlist/confirm', method: 'POST' },
] as const
