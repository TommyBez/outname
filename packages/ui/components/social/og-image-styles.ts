import type { CSSProperties } from 'react'

export const ogAccentColor = '#ff3000'
export const ogInkColor = '#0a0a0f'
export const ogPaperColor = '#ffffff'

export const ogCanvasStyle: CSSProperties = {
  alignItems: 'stretch',
  background: ogPaperColor,
  color: ogInkColor,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'Arial, Helvetica, sans-serif',
  height: '100%',
  justifyContent: 'space-between',
  overflow: 'hidden',
  padding: 48,
  position: 'relative',
  width: '100%',
}

export const ogGridOverlayStyle: CSSProperties = {
  backgroundImage:
    'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)',
  backgroundSize: '32px 32px',
  bottom: 0,
  display: 'flex',
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
}

export const ogFrameStyle: CSSProperties = {
  border: `4px solid ${ogInkColor}`,
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: 38,
  position: 'relative',
}

export const ogHeaderRowStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
}

export const ogMarkBadgeStyle: CSSProperties = {
  alignItems: 'center',
  background: ogInkColor,
  color: ogPaperColor,
  display: 'flex',
  fontSize: 42,
  fontWeight: 900,
  height: 84,
  justifyContent: 'center',
  letterSpacing: '-0.08em',
  width: 84,
}

export const ogEyebrowColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

export const ogEyebrowAccentStyle: CSSProperties = {
  color: ogAccentColor,
  display: 'flex',
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
}

export const ogEyebrowSublineStyle: CSSProperties = {
  display: 'flex',
  fontSize: 24,
  fontWeight: 700,
  letterSpacing: '-0.02em',
}

export const ogHeroColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  maxWidth: 960,
}

export const ogHeroTitleStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontSize: 76,
  fontWeight: 950,
  letterSpacing: '-0.085em',
  lineHeight: 0.86,
  textTransform: 'uppercase',
}

export const ogHeroLeadStyle: CSSProperties = {
  borderLeft: `2px solid ${ogAccentColor}`,
  display: 'flex',
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1.12,
  paddingLeft: 20,
  width: 800,
}

export const ogFooterRowStyle: CSSProperties = {
  alignItems: 'flex-end',
  display: 'flex',
  justifyContent: 'space-between',
}

export const ogFooterWordmarkStyle: CSSProperties = {
  borderTop: `4px solid ${ogInkColor}`,
  display: 'flex',
  fontSize: 50,
  fontWeight: 950,
  letterSpacing: '-0.08em',
  paddingTop: 12,
}

export const ogFooterCtaStyle: CSSProperties = {
  alignItems: 'center',
  background: ogAccentColor,
  display: 'flex',
  fontSize: 20,
  fontWeight: 900,
  height: 52,
  justifyContent: 'center',
  letterSpacing: '0.18em',
  padding: '0 24px',
  textTransform: 'uppercase',
}

export const ogBlogLabelStyle: CSSProperties = {
  color: ogAccentColor,
  display: 'flex',
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
}

export const ogBlogBodyColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  maxWidth: 980,
}

export const blogTitleStyle = (kind: 'index' | 'post'): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  fontSize: kind === 'index' ? 68 : 56,
  fontWeight: 950,
  letterSpacing: '-0.08em',
  lineHeight: 0.9,
  textTransform: 'uppercase',
})

export const ogBlogDescriptionStyle: CSSProperties = {
  borderLeft: `8px solid ${ogAccentColor}`,
  display: 'flex',
  fontSize: 26,
  fontWeight: 700,
  lineHeight: 1.15,
  paddingLeft: 20,
}

export const ogBlogDateStyle: CSSProperties = {
  display: 'flex',
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

export const ogTagListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

export const ogTagChipStyle: CSSProperties = {
  border: `2px solid ${ogInkColor}`,
  display: 'flex',
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: '0.12em',
  padding: '6px 12px',
  textTransform: 'uppercase',
}

export const ogBlogFooterWordmarkColumnStyle: CSSProperties = {
  borderTop: `4px solid ${ogInkColor}`,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  paddingTop: 12,
}

export const ogBlogSiteNameStyle: CSSProperties = {
  display: 'flex',
  fontSize: 44,
  fontWeight: 950,
  letterSpacing: '-0.08em',
}

export const ogBlogTaglineStyle: CSSProperties = {
  display: 'flex',
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
}

export const ogBlogCtaStyle: CSSProperties = {
  alignItems: 'center',
  background: ogAccentColor,
  color: ogPaperColor,
  display: 'flex',
  fontSize: 18,
  fontWeight: 900,
  height: 52,
  justifyContent: 'center',
  letterSpacing: '0.16em',
  padding: '0 24px',
  textTransform: 'uppercase',
}
