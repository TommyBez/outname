/** Public path served by Next.js apps that host transactional email assets. */
export const EMAIL_LOGO_PUBLIC_PATH = '/email/outna-logo.png'

export function buildEmailLogoUrl(baseUrl: string): string {
  return new URL(EMAIL_LOGO_PUBLIC_PATH, baseUrl).toString()
}
