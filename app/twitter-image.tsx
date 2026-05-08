import {
  createSocialImageResponse,
  socialImageSize,
} from '@/shared/components/social/social-image'
import { siteConfig } from '@/shared/server/site-metadata'

export const alt = siteConfig.ogImageAlt

export const size = socialImageSize

export const contentType = 'image/png'

export default function Image() {
  return createSocialImageResponse()
}
