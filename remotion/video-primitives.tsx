import type { CSSProperties, ReactNode } from 'react'

interface VideoPanelProps {
  children: ReactNode
  emphasis?: boolean
  style?: CSSProperties
}

export function VideoPanel({
  children,
  emphasis = false,
  style,
}: VideoPanelProps) {
  const background = emphasis ? '#000000' : '#ffffff'
  const color = emphasis ? '#ffffff' : '#000000'

  return (
    <div
      style={{
        background,
        border: '3px solid #000000',
        color,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

interface VideoLabelProps {
  children: ReactNode
  invert?: boolean
  style?: CSSProperties
}

export function VideoLabel({
  children,
  invert = false,
  style,
}: VideoLabelProps) {
  return (
    <span
      style={{
        color: invert ? 'rgba(255,255,255,0.7)' : '#ff3000',
        display: 'inline-flex',
        fontFamily: 'var(--font-mono)',
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: '0.18em',
        lineHeight: 1,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

interface VideoTagProps {
  active?: boolean
  children: ReactNode
}

export function VideoTag({ children, active = false }: VideoTagProps) {
  return (
    <span
      style={{
        alignItems: 'center',
        background: active ? '#ff3000' : '#f2f2f2',
        border: '2px solid #000000',
        color: '#000000',
        display: 'inline-flex',
        fontFamily: 'var(--font-mono)',
        fontSize: 17,
        fontWeight: 800,
        gap: 8,
        letterSpacing: '0.08em',
        lineHeight: 1,
        padding: '10px 12px',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  )
}
