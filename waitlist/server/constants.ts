export const WAITLIST_ENTRY_STATUSES = [
  'pending',
  'confirmed',
  'invited',
  'converted',
  'unsubscribed',
] as const

export type WaitlistEntryStatus = (typeof WAITLIST_ENTRY_STATUSES)[number]

export const WAITLIST_PRIMARY_INTERESTS = [
  'early-access',
  'open-source-release',
  'self-host-vercel',
  'architecture-notes',
] as const

export const WAITLIST_PRIMARY_INTEREST_OPTIONS = [
  { label: 'Try early access', value: 'early-access' },
  { label: 'Get the open-source release', value: 'open-source-release' },
  { label: 'Self-host on Vercel', value: 'self-host-vercel' },
  { label: 'Architecture/build notes', value: 'architecture-notes' },
] as const

export type WaitlistPrimaryInterest =
  (typeof WAITLIST_PRIMARY_INTERESTS)[number]

export const WAITLIST_PROFILE_TYPES = [
  'developer',
  'founder-operator',
  'product-design',
  'technical-leader',
  'other',
] as const

export const WAITLIST_PROFILE_TYPE_OPTIONS = [
  { label: 'Developer', value: 'developer' },
  { label: 'Founder / operator', value: 'founder-operator' },
  { label: 'Product / design', value: 'product-design' },
  { label: 'Technical leader', value: 'technical-leader' },
  { label: 'Other', value: 'other' },
] as const

export type WaitlistProfileType = (typeof WAITLIST_PROFILE_TYPES)[number]

export const WAITLIST_CONFIRMATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export const WAITLIST_CONFIRMATION_RESEND_COOLDOWN_MS = 1000 * 60 // 60 seconds

export const WAITLIST_RATE_LIMIT_MAX_REQUESTS = 10
export const WAITLIST_RATE_LIMIT_WINDOW = '10 m'

export const WAITLIST_GENERIC_SUCCESS_MESSAGE =
  'If this address can receive updates, check your inbox for the next step.'
