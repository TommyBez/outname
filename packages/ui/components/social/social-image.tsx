import { siteConfig } from '@outname/shared/server/site-metadata'
import {
  ogCanvasStyle,
  ogEyebrowAccentStyle,
  ogEyebrowColumnStyle,
  ogEyebrowSublineStyle,
  ogFooterCtaStyle,
  ogFooterRowStyle,
  ogFooterWordmarkStyle,
  ogFrameStyle,
  ogGridOverlayStyle,
  ogHeaderRowStyle,
  ogHeroColumnStyle,
  ogHeroLeadStyle,
  ogHeroTitleStyle,
  ogMarkBadgeStyle,
} from '@outname/ui/components/social/og-image-styles'
import { ImageResponse } from 'next/og'

export const socialImageSize = {
  width: 1200,
  height: 630,
} as const

export const createSocialImageResponse = () =>
  new ImageResponse(
    <div style={ogCanvasStyle}>
      <div style={ogGridOverlayStyle} />
      <div style={ogFrameStyle}>
        <div style={ogHeaderRowStyle}>
          <div style={ogEyebrowColumnStyle}>
            <div style={ogEyebrowAccentStyle}>Personal agent OS</div>
            <div style={ogEyebrowSublineStyle}>
              Memory / Schedule / Tools / Sandbox
            </div>
          </div>
          <div style={ogMarkBadgeStyle}>ON</div>
        </div>

        <div style={ogHeroColumnStyle}>
          <div style={ogHeroTitleStyle}>
            <span>Personal AI</span>
            <span>agents that</span>
            <span>keep working.</span>
          </div>
          <div style={ogHeroLeadStyle}>
            Create durable agents that remember context, return on schedule, and
            execute real tasks through connected tools.
          </div>
        </div>

        <div style={ogFooterRowStyle}>
          <div style={ogFooterWordmarkStyle}>{siteConfig.name}</div>
          <div style={ogFooterCtaStyle}>Out of the inbox</div>
        </div>
      </div>
    </div>,
    {
      ...socialImageSize,
    }
  )
