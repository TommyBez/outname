import { ImageResponse } from 'next/og'
import { siteConfig } from '@/shared/server/site-metadata'

export const socialImageSize = {
  width: 1200,
  height: 630,
} as const

export const createSocialImageResponse = () =>
  new ImageResponse(
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
          opacity: 1,
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
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div
              style={{
                color: '#ff3000',
                display: 'flex',
                fontSize: 24,
                fontWeight: 900,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
              }}
            >
              Personal agent OS
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              Memory / Schedule / Tools / Sandbox
            </div>
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
            ON
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            maxWidth: 960,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 76,
              fontWeight: 950,
              letterSpacing: '-0.085em',
              lineHeight: 0.86,
              textTransform: 'uppercase',
            }}
          >
            <span>Personal AI</span>
            <span>agents that</span>
            <span>keep working.</span>
          </div>
          <div
            style={{
              borderLeft: '8px solid #ff3000',
              display: 'flex',
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1.12,
              paddingLeft: 20,
              width: 800,
            }}
          >
            Create durable agents that remember context, return on schedule, and
            execute real tasks through connected tools.
          </div>
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
              fontSize: 50,
              fontWeight: 950,
              letterSpacing: '-0.08em',
              paddingTop: 12,
            }}
          >
            {siteConfig.name}
          </div>
          <div
            style={{
              alignItems: 'center',
              background: '#ff3000',
              display: 'flex',
              fontSize: 20,
              fontWeight: 900,
              height: 52,
              justifyContent: 'center',
              letterSpacing: '0.18em',
              padding: '0 24px',
              textTransform: 'uppercase',
            }}
          >
            Out of the inbox
          </div>
        </div>
      </div>
    </div>,
    {
      ...socialImageSize,
    }
  )
