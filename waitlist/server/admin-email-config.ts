import 'server-only'

export function getWaitlistAdminEmail(): string | null {
  const adminEmail = process.env.WAITLIST_ADMIN_EMAIL?.trim()
  return adminEmail ? adminEmail : null
}
