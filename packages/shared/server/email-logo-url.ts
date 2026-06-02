import 'server-only'

import { buildEmailLogoUrl } from '@outname/email/email-logo'
import { getEmailWebOrigin } from './email-urls'

/** Absolute URL for the logo hosted by the marketing web app (`apps/web`). */
export function getEmailLogoUrl(): string {
  return buildEmailLogoUrl(getEmailWebOrigin())
}
