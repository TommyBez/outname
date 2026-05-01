import { siteConfig } from '@/lib/site-metadata'
import { createSocialImageResponse, socialImageSize } from '@/lib/social-image'

export const alt = siteConfig.ogImageAlt

export const size = socialImageSize

export const contentType = 'image/png'

export default function Image() {
  return createSocialImageResponse()
}
