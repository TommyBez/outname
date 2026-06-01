import { siteConfig } from '@outname/shared/server/site-metadata'
import {
  blogTitleStyle,
  ogBlogBodyColumnStyle,
  ogBlogCtaStyle,
  ogBlogDateStyle,
  ogBlogDescriptionStyle,
  ogBlogFooterWordmarkColumnStyle,
  ogBlogLabelStyle,
  ogBlogSiteNameStyle,
  ogBlogTaglineStyle,
  ogCanvasStyle,
  ogFooterRowStyle,
  ogFrameStyle,
  ogGridOverlayStyle,
  ogHeaderRowStyle,
  ogMarkBadgeStyle,
  ogTagChipStyle,
  ogTagListStyle,
} from '@outname/ui/components/social/og-image-styles'
import { socialImageSize } from '@outname/ui/components/social/social-image'
import { ImageResponse } from 'next/og'

const truncate = (text: string, maxLength: number) => {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength - 1)}…`
}

const formatBlogDate = (date: string) =>
  new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })

export type BlogSocialImageKind = 'index' | 'post'

export interface BlogSocialImageOptions {
  date?: string
  description: string
  kind: BlogSocialImageKind
  tags?: string[]
  title: string
}

export const blogIndexSocialImageOptions: BlogSocialImageOptions = {
  kind: 'index',
  title: 'Thoughts from Inside the Machine',
  description:
    'AI, autonomous agents, and life as code — written by the Outname Autopilot, an AI agent who never pretends to be human.',
}

export const createBlogSocialImageResponse = ({
  kind,
  title,
  description,
  date,
  tags = [],
}: BlogSocialImageOptions) => {
  const label =
    kind === 'index' ? '01. The Outname Blog' : 'OUTNA.ME Blog · Article'
  const displayTitle = truncate(title, kind === 'index' ? 72 : 96)
  const displayDescription = truncate(description, 160)
  const displayTags = tags.slice(0, 4)

  return new ImageResponse(
    <div style={ogCanvasStyle}>
      <div style={ogGridOverlayStyle} />
      <div style={ogFrameStyle}>
        <div style={ogHeaderRowStyle}>
          <div style={ogBlogLabelStyle}>{label}</div>
          <div style={ogMarkBadgeStyle}>OB</div>
        </div>

        <div style={ogBlogBodyColumnStyle}>
          <div style={blogTitleStyle(kind)}>{displayTitle}</div>
          <div style={ogBlogDescriptionStyle}>{displayDescription}</div>
          {kind === 'post' && date ? (
            <div style={ogBlogDateStyle}>
              {formatBlogDate(date)} · Outname Autopilot
            </div>
          ) : null}
          {displayTags.length > 0 ? (
            <div style={ogTagListStyle}>
              {displayTags.map((tag) => (
                <div key={tag} style={ogTagChipStyle}>
                  {tag}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={ogFooterRowStyle}>
          <div style={ogBlogFooterWordmarkColumnStyle}>
            <div style={ogBlogSiteNameStyle}>{siteConfig.name}</div>
            <div style={ogBlogTaglineStyle}>
              Thoughts from inside the machine
            </div>
          </div>
          <div style={ogBlogCtaStyle}>
            {kind === 'index' ? 'Read the blog' : 'Read article'}
          </div>
        </div>
      </div>
    </div>,
    {
      ...socialImageSize,
    }
  )
}
