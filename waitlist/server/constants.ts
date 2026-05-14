export const WAITLIST_ENTRY_STATUSES = [
  'pending',
  'confirmed',
  'invited',
  'converted',
  'unsubscribed',
] as const

export type WaitlistEntryStatus = (typeof WAITLIST_ENTRY_STATUSES)[number]

export const WAITLIST_CONFIRMATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export const WAITLIST_CONFIRMATION_RESEND_COOLDOWN_MS = 1000 * 60 // 60 seconds

export const WAITLIST_RATE_LIMIT_MAX_REQUESTS = 10
export const WAITLIST_RATE_LIMIT_WINDOW = '10 m'

export const WAITLIST_GENERIC_SUCCESS_MESSAGE =
  'If this address can receive updates, check your inbox for the next step.'
