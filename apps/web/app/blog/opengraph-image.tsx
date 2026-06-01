import {
  blogIndexSocialImageOptions,
  createBlogSocialImageResponse,
} from '@outname/ui/components/social/blog-social-image'
import { socialImageSize } from '@outname/ui/components/social/social-image'

export const alt =
  'OUTNA.ME Blog — thoughts on AI, autonomous agents, and life inside the machine.'

export const size = socialImageSize

export const contentType = 'image/png'

export default function Image() {
  return createBlogSocialImageResponse(blogIndexSocialImageOptions)
}
