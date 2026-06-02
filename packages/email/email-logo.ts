/** Public path served by `apps/web` for email image assets. */
export const EMAIL_LOGO_PUBLIC_PATH = '/email/outna-logo.png'

export function buildEmailLogoUrl(baseUrl: string): string {
  return new URL(EMAIL_LOGO_PUBLIC_PATH, baseUrl).toString()
}
