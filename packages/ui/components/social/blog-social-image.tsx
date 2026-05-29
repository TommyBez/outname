import { siteConfig } from '@outname/shared/server/site-metadata'
import { socialImageSize } from '@outname/ui/components/social/social-image'
import { ImageResponse } from 'next/og'

const accentColor = '#ff3000'

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
    <div
      style={{
        alignItems: 'stretch',
        background: '#ffffff',
        color: '#000000',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Arial, Helvetica, sans-serif',
        height: '100%',
        justifyContent: 'space-between',
        overflow: 'hidden',
        padding: 48,
        position: 'relative',
        width: '100%',
      }}
    >
      <div
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          bottom: 0,
          display: 'flex',
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      />
      <div
        style={{
          border: '4px solid #000000',
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 38,
          position: 'relative',
        }}
      >
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              color: accentColor,
              display: 'flex',
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </div>
          <div
            style={{
              alignItems: 'center',
              background: '#000000',
              color: '#ffffff',
              display: 'flex',
              fontSize: 42,
              fontWeight: 900,
              height: 84,
              justifyContent: 'center',
              letterSpacing: '-0.08em',
              width: 84,
            }}
          >
            OB
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            maxWidth: 980,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: kind === 'index' ? 68 : 56,
              fontWeight: 950,
              letterSpacing: '-0.08em',
              lineHeight: 0.9,
              textTransform: 'uppercase',
            }}
          >
            {displayTitle}
          </div>
          <div
            style={{
              borderLeft: `8px solid ${accentColor}`,
              display: 'flex',
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1.15,
              paddingLeft: 20,
            }}
          >
            {displayDescription}
          </div>
          {kind === 'post' && date ? (
            <div
              style={{
                display: 'flex',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {formatBlogDate(date)} · Outname Autopilot
            </div>
          ) : null}
          {displayTags.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {displayTags.map((tag) => (
                <div
                  key={tag}
                  style={{
                    border: '2px solid #000000',
                    display: 'flex',
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    padding: '6px 12px',
                    textTransform: 'uppercase',
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          style={{
            alignItems: 'flex-end',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              borderTop: '4px solid #000000',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              paddingTop: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 44,
                fontWeight: 950,
                letterSpacing: '-0.08em',
              }}
            >
              {siteConfig.name}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              Thoughts from inside the machine
            </div>
          </div>
          <div
            style={{
              alignItems: 'center',
              background: accentColor,
              color: '#ffffff',
              display: 'flex',
              fontSize: 18,
              fontWeight: 900,
              height: 52,
              justifyContent: 'center',
              letterSpacing: '0.16em',
              padding: '0 24px',
              textTransform: 'uppercase',
            }}
          >
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
