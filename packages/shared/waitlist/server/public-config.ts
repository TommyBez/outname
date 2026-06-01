import 'server-only'

export function isWaitlistPublicEnabled(): boolean {
  return process.env.WAITLIST_PUBLIC_ENABLED === 'true'
}
