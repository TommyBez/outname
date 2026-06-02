import { siteConfig } from '@outname/shared/server/site-metadata'
import {
  createSocialImageResponse,
  socialImageSize,
} from '@outname/ui/components/social/social-image'

export const alt = siteConfig.ogImageAlt

export const size = socialImageSize

export const contentType = 'image/png'

export default function Image() {
  return createSocialImageResponse()
}
