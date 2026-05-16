import type { CSSProperties, ReactNode } from 'react'
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion'
import type {
  LaunchVideoAspect,
  LaunchVideoSlug,
} from '@/content/outname-launch/assets/video-manifest'
import { appear, progressBetween } from './animation'
import { VideoLabel, VideoPanel, VideoTag } from './video-primitives'

export interface LaunchVideoProps {
  [key: string]: unknown
}

interface VideoMeta {
  cta: string
  eyebrow: string
  headline: string
  subline: string
}

interface VideoLayout {
  bodyGap: number
  ctaSize: number
  eyebrowSize: number
  footerNoteSize: number
  headlineSize: number
  padding: number
  scenePadding: number
  sublineSize: number
}

interface BrandCloseLayout {
  captionSize: number
  columns: string
  gap: number
  logoSize: number
  textAlign: 'center' | 'left'
  wordmarkAlign: 'center' | 'start'
  wordmarkGap: number
  wordmarkSize: number
}

interface WhyFilmLayout {
  edge: number
  finalCaptionSize: number
  finalLogoSize: number
  finalWordmarkSize: number
  fragmentSize: number
  giantSize: number
  monoSize: number
  thesisSize: number
}

interface AgentConfigFilmLayout extends WhyFilmLayout {
  captionSize: number
  labelSize: number
  optionSize: number
}

interface AutonomousRunFilmLayout extends WhyFilmLayout {
  captionSize: number
  microSize: number
  taskSize: number
}

interface MemoryFilmLayout extends WhyFilmLayout {
  captionSize: number
  fileSize: number
  microSize: number
}

interface ComposableFilmLayout extends WhyFilmLayout {
  channelSize: number
  chipSize: number
  moduleSize: number
  smallSize: number
}

const CTA_START_FRAME = 420
const BODY_START_FRAME = 76
const BRAND_CLOSE_FRAME = 488
const WHY_OUTNAME_SLUG = '2026-05-18-why-outname-exists'
const AGENT_CONFIGURATION_SLUG = '2026-05-20-agent-configuration'
const AUTONOMOUS_RUN_SLUG = '2026-05-22-autonomous-run'
const MEMORY_OVER_TIME_SLUG = '2026-05-26-memory-over-time'
const COMPOSABLE_CHANNELS_SLUG = '2026-05-28-composable-channels'

const videoMeta: Record<LaunchVideoSlug, VideoMeta> = {
  '2026-05-18-why-outname-exists': {
    cta: 'OUTNA.ME / waitlist open',
    eyebrow: 'why outna.me',
    headline: 'Less context rebuilding.',
    subline: 'Solo work should resume.',
  },
  '2026-05-20-agent-configuration': {
    cta: 'model / identity / schedule',
    eyebrow: 'agent configuration',
    headline: 'Agents need shape.',
    subline: 'Model. Identity. Schedule.',
  },
  '2026-05-22-autonomous-run': {
    cta: 'calendar / follow-ups / brief',
    eyebrow: 'autonomous run',
    headline: 'Work starts without me.',
    subline: 'Calendar. Follow-ups. Memory.',
  },
  '2026-05-26-memory-over-time': {
    cta: 'less setup every run',
    eyebrow: 'memory over time',
    headline: 'Better defaults every run.',
    subline: 'Memory becomes momentum.',
  },
  '2026-05-28-composable-channels': {
    cta: 'tools / sub-agents / channels',
    eyebrow: 'composability',
    headline: 'Agents need surfaces.',
    subline: 'Tools. Channels. Sub-agents.',
  },
  '2026-05-20-vercel-stack': {
    cta: 'built on Vercel primitives',
    eyebrow: 'vercel-native stack',
    headline: 'An agent runtime on Vercel.',
    subline: 'AI SDK. Workflow. Sandbox. Crons.',
  },
}

export function LaunchVideo(props: LaunchVideoProps) {
  const frame = useCurrentFrame()
  const aspect = getLaunchVideoAspect(props.aspect)
  const slug = getLaunchVideoSlug(props.slug)
  const layout = getLayout(aspect)
  const meta = videoMeta[slug]

  if (slug === WHY_OUTNAME_SLUG) {
    return <WhyOutnameFilm aspect={aspect} frame={frame} />
  }

  if (slug === AGENT_CONFIGURATION_SLUG) {
    return <AgentConfigurationFilm aspect={aspect} frame={frame} />
  }

  if (slug === AUTONOMOUS_RUN_SLUG) {
    return <AutonomousRunFilm aspect={aspect} frame={frame} />
  }

  if (slug === MEMORY_OVER_TIME_SLUG) {
    return <MemoryOverTimeFilm aspect={aspect} frame={frame} />
  }

  if (slug === COMPOSABLE_CHANNELS_SLUG) {
    return <ComposableChannelsFilm aspect={aspect} frame={frame} />
  }

  return (
    <AbsoluteFill
      className="outname-video-root"
      style={{
        background: '#ffffff',
        overflow: 'hidden',
        padding: layout.padding,
      }}
    >
      <VideoShell aspect={aspect} frame={frame} layout={layout} meta={meta}>
        {renderStory(slug, aspect, frame, layout)}
      </VideoShell>
      <BrandClosingOverlay aspect={aspect} frame={frame} />
    </AbsoluteFill>
  )
}

function WhyOutnameFilm({
  aspect,
  frame,
}: {
  aspect: LaunchVideoAspect
  frame: number
}) {
  const layout = getWhyFilmLayout(aspect)

  return (
    <AbsoluteFill
      className="outname-video-root"
      style={{
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <ColdOpen frame={frame} layout={layout} />
      <ContextFragments aspect={aspect} frame={frame} layout={layout} />
      <ResetBeat frame={frame} layout={layout} />
      <BuilderLoad aspect={aspect} frame={frame} layout={layout} />
      <ThesisBeat frame={frame} layout={layout} />
      <SystemShape aspect={aspect} frame={frame} layout={layout} />
      <WhyEndCard aspect={aspect} frame={frame} layout={layout} />
    </AbsoluteFill>
  )
}

function AgentConfigurationFilm({
  aspect,
  frame,
}: {
  aspect: LaunchVideoAspect
  frame: number
}) {
  const layout = getAgentConfigFilmLayout(aspect)

  return (
    <AbsoluteFill
      className="outname-video-root"
      style={{
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <AgentConfigColdOpen aspect={aspect} frame={frame} layout={layout} />
      <AgentConfigSplit aspect={aspect} frame={frame} layout={layout} />
      <AgentModelZoom aspect={aspect} frame={frame} layout={layout} />
      <AgentIdentityCut aspect={aspect} frame={frame} layout={layout} />
      <AgentScheduleCut aspect={aspect} frame={frame} layout={layout} />
      <AgentAssembly aspect={aspect} frame={frame} layout={layout} />
      <FilmEndCard
        aspect={aspect}
        endFrame={600}
        enterFrame={550}
        frame={frame}
        layout={layout}
        startFrame={536}
      />
    </AbsoluteFill>
  )
}

function AgentConfigColdOpen({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: AgentConfigFilmLayout
}) {
  const scene = sceneOpacity(frame, 0, 86, 12)
  const drift = ease(frame, 0, 76, [0, 1])
  const isWide = aspect === '16x9'

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#ff3000',
          height: isWide ? '60%' : '54%',
          left: layout.edge,
          position: 'absolute',
          top: layout.edge,
          transform: `scaleY(${ease(frame, 8, 34, [0, 1])})`,
          transformOrigin: 'top',
          width: Math.max(8, layout.monoSize * 0.55),
        }}
      />
      <div
        style={{
          background: '#000000',
          height: isWide ? '52%' : '44%',
          left: '50%',
          position: 'absolute',
          top: '50%',
          transform: `translate(-50%, -50%) rotate(${-4 + drift * 2}deg) scale(${0.92 + drift * 0.18})`,
          width: isWide ? '58%' : '68%',
        }}
      />
      <h2
        style={{
          color: '#ffffff',
          fontSize: layout.giantSize,
          fontWeight: 950,
          left: '50%',
          letterSpacing: 0,
          lineHeight: 0.82,
          margin: 0,
          opacity: appear(frame, 14, 24),
          position: 'absolute',
          textAlign: 'center',
          textTransform: 'uppercase',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${0.94 + drift * 0.08})`,
          whiteSpace: 'nowrap',
        }}
      >
        TOO GENERIC
      </h2>
      <div
        style={{
          background: '#ff3000',
          bottom: layout.edge,
          height: Math.max(6, layout.monoSize * 0.42),
          left: layout.edge,
          opacity: ease(frame, 40, 72, [0, 1]),
          position: 'absolute',
          transform: `scaleX(${ease(frame, 40, 72, [0, 1])})`,
          transformOrigin: 'left',
          width: aspectLineWidth(layout),
        }}
      />
    </AbsoluteFill>
  )
}

function AgentConfigSplit({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: AgentConfigFilmLayout
}) {
  const scene = sceneOpacity(frame, 66, 190, 14)
  const isWide = aspect === '16x9'
  const pieces = [
    {
      color: '#000000',
      delay: 78,
      text: 'MODEL',
      x: isWide ? -260 : -92,
      y: isWide ? -116 : -212,
    },
    {
      color: '#ff3000',
      delay: 96,
      text: 'IDENTITY',
      x: isWide ? 188 : 82,
      y: isWide ? 18 : 0,
    },
    {
      color: '#000000',
      delay: 130,
      text: 'SCHEDULE',
      x: isWide ? -112 : -44,
      y: isWide ? 152 : 212,
    },
  ] as const

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      {pieces.map((piece, index) => {
        const enter = appear(frame, piece.delay, 24)
        const settle = ease(frame, piece.delay + 12, piece.delay + 40, [0, 1])
        const width = piece.text === 'IDENTITY' ? 390 : 330
        const height = piece.text === 'SCHEDULE' ? 128 : 118

        return (
          <div
            key={piece.text}
            style={{
              alignItems: 'center',
              background: piece.color,
              border: `4px solid ${piece.color === '#ff3000' ? '#000000' : '#ffffff'}`,
              color: piece.color === '#ff3000' ? '#000000' : '#ffffff',
              display: 'flex',
              height,
              justifyContent: 'center',
              left: '50%',
              opacity: enter,
              position: 'absolute',
              top: '50%',
              transform: `translate(calc(-50% + ${piece.x * settle}px), calc(-50% + ${piece.y * settle}px)) rotate(${(1 - enter) * (index === 1 ? 5 : -5)}deg) scale(${0.82 + enter * 0.18})`,
              transformOrigin: 'center',
              width: isWide ? width * 1.12 : width,
            }}
          >
            <strong
              style={{
                fontSize: layout.labelSize,
                fontWeight: 950,
                letterSpacing: 0,
                lineHeight: 1,
                textTransform: 'uppercase',
              }}
            >
              {piece.text}
            </strong>
          </div>
        )
      })}
      <div
        style={{
          background: '#ff3000',
          height: Math.max(8, layout.monoSize * 0.48),
          left: layout.edge,
          opacity: ease(frame, 142, 178, [0, 1]),
          position: 'absolute',
          top: layout.edge,
          transform: `scaleX(${ease(frame, 142, 178, [0, 1])})`,
          transformOrigin: 'left',
          width: isWide ? '30%' : '42%',
        }}
      />
    </AbsoluteFill>
  )
}

function AgentModelZoom({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: AgentConfigFilmLayout
}) {
  const scene = sceneOpacity(frame, 168, 304, 16)
  const zoom = ease(frame, 178, 286, [0, 1])
  const options = [
    { delay: 206, text: 'FAST' },
    { delay: 226, text: 'DEEP' },
    { delay: 246, text: 'CHEAP' },
  ] as const
  const isWide = aspect === '16x9'

  return (
    <AbsoluteFill
      style={{
        background: '#000000',
        opacity: scene,
      }}
    >
      <div
        style={{
          color: '#ffffff',
          left: layout.edge,
          position: 'absolute',
          top: layout.edge,
          transform: `translate3d(${zoom * (isWide ? 78 : 24)}px, ${zoom * 22}px, 0) scale(${1 + zoom * 0.12})`,
          transformOrigin: 'left top',
        }}
      >
        <span
          style={{
            color: '#ff3000',
            fontFamily: 'var(--font-mono)',
            fontSize: layout.captionSize,
            fontWeight: 900,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          model
        </span>
        <h2
          style={{
            fontSize: layout.giantSize * (isWide ? 1 : 0.74),
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 0.82,
            margin: `${layout.edge * 0.22}px 0 0`,
            textTransform: 'uppercase',
          }}
        >
          PICK THE
          <br />
          ENGINE
        </h2>
      </div>
      <div
        style={{
          display: 'grid',
          gap: layout.edge * 0.22,
          position: 'absolute',
          right: layout.edge,
          top: isWide ? layout.edge * 1.05 : layout.edge * 6.25,
          width: isWide ? '38%' : '72%',
        }}
      >
        {options.map((option) => {
          const enter = appear(frame, option.delay, 18)
          const selected = option.text === 'DEEP'
          const sweep = selected ? ease(frame, 250, 286, [0, 1]) : 0

          return (
            <div
              key={option.text}
              style={{
                background: selected ? '#ff3000' : '#ffffff',
                border: '4px solid #ffffff',
                color: '#000000',
                opacity: enter,
                overflow: 'hidden',
                padding: `${layout.edge * 0.22}px ${layout.edge * 0.3}px`,
                position: 'relative',
                transform: `translateX(${(1 - enter) * 66 - sweep * 18}px) scale(${1 + sweep * 0.05})`,
                transformOrigin: 'right center',
              }}
            >
              <strong
                style={{
                  fontSize: layout.optionSize,
                  fontWeight: 950,
                  lineHeight: 1,
                  textTransform: 'uppercase',
                }}
              >
                {option.text}
              </strong>
              {selected ? (
                <div
                  style={{
                    background: '#ffffff',
                    bottom: 0,
                    height: Math.max(5, layout.monoSize * 0.32),
                    left: 0,
                    position: 'absolute',
                    transform: `scaleX(${sweep})`,
                    transformOrigin: 'left',
                    width: '100%',
                  }}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function AgentIdentityCut({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: AgentConfigFilmLayout
}) {
  const scene = sceneOpacity(frame, 282, 420, 16)
  const enter = appear(frame, 298, 28)
  const cut = ease(frame, 318, 398, [0, 1])
  const isWide = aspect === '16x9'

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#ff3000',
          bottom: layout.edge,
          position: 'absolute',
          right: layout.edge,
          top: layout.edge,
          transform: `scaleY(${enter})`,
          transformOrigin: 'bottom',
          width: Math.max(10, layout.monoSize * 0.64),
        }}
      />
      <div
        style={{
          background: '#000000',
          color: '#ffffff',
          left: '50%',
          minHeight: isWide ? 420 : 520,
          padding: layout.edge * 0.62,
          position: 'absolute',
          top: '50%',
          transform: `translate(-50%, -50%) translateX(${(1 - enter) * -96}px) scale(${0.96 + enter * 0.04 + cut * 0.03})`,
          transformOrigin: 'center',
          width: isWide ? '62%' : '76%',
        }}
      >
        <span
          style={{
            color: '#ff3000',
            fontFamily: 'var(--font-mono)',
            fontSize: layout.captionSize,
            fontWeight: 900,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          identity
        </span>
        <div
          style={{
            display: 'grid',
            gap: layout.edge * 0.34,
            marginTop: layout.edge * 0.55,
          }}
        >
          <IdentityLine
            delay={324}
            frame={frame}
            label="role"
            size={layout.labelSize}
            value="RESEARCH OPERATOR"
          />
          <IdentityLine
            delay={356}
            frame={frame}
            label="tone"
            size={layout.labelSize}
            value="DIRECT"
          />
        </div>
      </div>
    </AbsoluteFill>
  )
}

function IdentityLine({
  delay,
  frame,
  label,
  size,
  value,
}: {
  delay: number
  frame: number
  label: string
  size: number
  value: string
}) {
  const enter = appear(frame, delay, 18)

  return (
    <div
      style={{
        borderTop: '4px solid #ffffff',
        opacity: enter,
        paddingTop: 16,
        transform: `translateY(${(1 - enter) * 28}px)`,
      }}
    >
      <span
        style={{
          color: '#ff3000',
          fontFamily: 'var(--font-mono)',
          fontSize: size * 0.34,
          fontWeight: 900,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <strong
        style={{
          display: 'block',
          fontSize: size,
          fontWeight: 950,
          lineHeight: 0.92,
          marginTop: 10,
          textTransform: 'uppercase',
        }}
      >
        {value}
      </strong>
    </div>
  )
}

function AgentScheduleCut({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: AgentConfigFilmLayout
}) {
  const scene = sceneOpacity(frame, 400, 494, 14)
  const enter = appear(frame, 410, 22)
  const tick = ease(frame, 436, 470, [0, 1])
  const isWide = aspect === '16x9'

  return (
    <AbsoluteFill
      style={{
        background: '#000000',
        opacity: scene,
      }}
    >
      <div
        style={{
          color: '#ffffff',
          left: layout.edge,
          position: 'absolute',
          top: layout.edge,
          transform: `translateY(${(1 - enter) * 38}px)`,
        }}
      >
        <span
          style={{
            color: '#ff3000',
            fontFamily: 'var(--font-mono)',
            fontSize: layout.captionSize,
            fontWeight: 900,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          schedule
        </span>
        <h2
          style={{
            fontSize: layout.giantSize * (isWide ? 0.96 : 0.82),
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 0.84,
            margin: `${layout.edge * 0.24}px 0 0`,
            textTransform: 'uppercase',
          }}
        >
          08:30
        </h2>
      </div>
      <div
        style={{
          bottom: layout.edge * 2.2,
          left: layout.edge,
          position: 'absolute',
          right: layout.edge,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            height: 5,
            transform: `scaleX(${enter})`,
            transformOrigin: 'left',
            width: '100%',
          }}
        />
        {[0.18, 0.5, 0.82].map((position, index) => {
          const isActive = index === 1

          return (
            <div
              key={position}
              style={{
                background: isActive ? '#ff3000' : '#ffffff',
                height: isActive ? 76 : 52,
                left: `${position * 100}%`,
                position: 'absolute',
                top: isActive ? -35 : -24,
                transform: `translateX(-50%) scaleY(${isActive ? tick : enter})`,
                transformOrigin: 'center',
                width: isActive ? 18 : 10,
              }}
            />
          )
        })}
        <strong
          style={{
            color: '#ff3000',
            fontFamily: 'var(--font-mono)',
            fontSize: layout.captionSize * 1.35,
            fontWeight: 950,
            left: '50%',
            letterSpacing: '0.12em',
            opacity: tick,
            position: 'absolute',
            textTransform: 'uppercase',
            top: 74,
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
          }}
        >
          MON / WED / FRI
        </strong>
      </div>
    </AbsoluteFill>
  )
}

function AgentAssembly({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: AgentConfigFilmLayout
}) {
  const scene = sceneOpacity(frame, 476, 552, 14)
  const assemble = ease(frame, 486, 526, [0, 1])
  const textIn = appear(frame, 512, 22)
  const clearBlocks = ease(frame, 512, 532, [0, 1])
  const isWide = aspect === '16x9'
  const blocks = [
    { color: '#ffffff', text: 'MODEL', x: -1, y: -1 },
    { color: '#ff3000', text: 'IDENTITY', x: 1, y: -0.2 },
    { color: '#ffffff', text: 'SCHEDULE', x: -0.2, y: 1 },
  ] as const

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#000000',
          bottom: layout.edge,
          left: layout.edge,
          overflow: 'hidden',
          position: 'absolute',
          right: layout.edge,
          top: layout.edge,
          transform: `scale(${0.96 + assemble * 0.04})`,
          transformOrigin: 'center',
        }}
      >
        {blocks.map((block) => (
          <div
            key={block.text}
            style={{
              background: block.color,
              border: '4px solid #ffffff',
              color: '#000000',
              left: '50%',
              opacity: 1 - clearBlocks,
              padding: `${layout.edge * 0.18}px ${layout.edge * 0.28}px`,
              position: 'absolute',
              top: '50%',
              transform: `translate(calc(-50% + ${block.x * (1 - assemble) * (isWide ? 420 : 260)}px), calc(-50% + ${block.y * (1 - assemble) * (isWide ? 250 : 290)}px)) scale(${0.82 + assemble * 0.12})`,
              transformOrigin: 'center',
            }}
          >
            <strong
              style={{
                fontSize: layout.captionSize * 1.3,
                fontWeight: 950,
                lineHeight: 1,
                textTransform: 'uppercase',
              }}
            >
              {block.text}
            </strong>
          </div>
        ))}
        <div
          style={{
            color: '#ffffff',
            left: '50%',
            opacity: textIn,
            position: 'absolute',
            textAlign: 'center',
            top: '50%',
            transform: `translate(-50%, -50%) translateY(${(1 - textIn) * 34}px)`,
            width: isWide ? '62%' : '76%',
          }}
        >
          <h2
            style={{
              fontSize: layout.thesisSize * (isWide ? 0.82 : 0.72),
              fontWeight: 950,
              letterSpacing: 0,
              lineHeight: 0.86,
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            AGENT
            <br />
            CONFIGURED
          </h2>
          <p
            style={{
              color: '#ff3000',
              fontFamily: 'var(--font-mono)',
              fontSize: layout.captionSize * 1.08,
              fontWeight: 900,
              letterSpacing: '0.12em',
              margin: `${layout.edge * 0.34}px 0 0`,
              textTransform: 'uppercase',
            }}
          >
            built for one job
          </p>
        </div>
      </div>
    </AbsoluteFill>
  )
}

function AutonomousRunFilm({
  aspect,
  frame,
}: {
  aspect: LaunchVideoAspect
  frame: number
}) {
  const layout = getAutonomousRunFilmLayout(aspect)

  return (
    <AbsoluteFill
      className="outname-video-root"
      style={{
        background: '#000000',
        overflow: 'hidden',
      }}
    >
      <RunWake aspect={aspect} frame={frame} layout={layout} />
      <RunScheduleFires aspect={aspect} frame={frame} layout={layout} />
      <RunCalendarTask aspect={aspect} frame={frame} layout={layout} />
      <RunFollowUpsTask aspect={aspect} frame={frame} layout={layout} />
      <RunBriefTask aspect={aspect} frame={frame} layout={layout} />
      <RunMemoryUpdate aspect={aspect} frame={frame} layout={layout} />
      <RunNextRun aspect={aspect} frame={frame} layout={layout} />
      <FilmEndCard
        aspect={aspect}
        endFrame={540}
        enterFrame={508}
        frame={frame}
        layout={layout}
        startFrame={492}
      />
    </AbsoluteFill>
  )
}

function RunWake({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: AutonomousRunFilmLayout
}) {
  const scene = sceneOpacity(frame, 0, 82, 12)
  const line = ease(frame, 8, 36, [0, 1])
  const pulse = ease(frame, 28, 52, [0, 1])
  const isWide = aspect === '16x9'

  return (
    <AbsoluteFill
      style={{
        background: '#000000',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          height: 5,
          left: layout.edge,
          position: 'absolute',
          right: layout.edge,
          top: isWide ? '58%' : '60%',
          transform: `scaleX(${line})`,
          transformOrigin: 'center',
        }}
      />
      <div
        style={{
          background: '#ff3000',
          height: layout.edge * (isWide ? 0.92 : 1.22),
          left: '50%',
          position: 'absolute',
          top: isWide ? '58%' : '60%',
          transform: `translate(-50%, -50%) scaleY(${0.76 + pulse * 0.42})`,
          transformOrigin: 'center',
          width: Math.max(14, layout.monoSize * 0.82),
        }}
      />
      <strong
        style={{
          color: '#ffffff',
          fontFamily: 'var(--font-mono)',
          fontSize: layout.giantSize * (isWide ? 0.76 : 0.72),
          fontWeight: 950,
          left: '50%',
          letterSpacing: 0,
          lineHeight: 1,
          opacity: appear(frame, 18, 22),
          position: 'absolute',
          top: isWide ? '37%' : '39%',
          transform: `translate(-50%, -50%) scale(${0.94 + pulse * 0.06})`,
        }}
      >
        08:30
      </strong>
    </AbsoluteFill>
  )
}

function RunScheduleFires({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: AutonomousRunFilmLayout
}) {
  const scene = sceneOpacity(frame, 58, 144, 12)
  const fire = ease(frame, 70, 116, [0, 1])
  const isWide = aspect === '16x9'
  const travelWidth = isWide ? 64 : 58

  return (
    <AbsoluteFill
      style={{
        background: '#000000',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          height: 5,
          left: layout.edge,
          position: 'absolute',
          right: layout.edge,
          top: isWide ? '60%' : '64%',
        }}
      />
      <div
        style={{
          background: '#ff3000',
          height: layout.edge * (isWide ? 0.9 : 1.1),
          left: `${18 + fire * travelWidth}%`,
          position: 'absolute',
          top: isWide ? '60%' : '64%',
          transform: 'translate(-50%, -50%)',
          width: Math.max(16, layout.monoSize * 0.9),
        }}
      />
      <div
        style={{
          background: '#ff3000',
          height: Math.max(7, layout.monoSize * 0.42),
          left: `${18 + fire * travelWidth}%`,
          opacity: 1 - fire * 0.3,
          position: 'absolute',
          top: isWide ? '60%' : '64%',
          transform: `translate(-100%, -50%) scaleX(${fire})`,
          transformOrigin: 'right',
          width: isWide ? '24%' : '34%',
        }}
      />
      <h2
        style={{
          color: '#ffffff',
          fontSize: layout.giantSize * (isWide ? 0.98 : 0.78),
          fontWeight: 950,
          left: layout.edge,
          letterSpacing: 0,
          lineHeight: 0.84,
          margin: 0,
          opacity: appear(frame, 82, 22),
          position: 'absolute',
          textTransform: 'uppercase',
          top: layout.edge,
          transform: `translateY(${(1 - appear(frame, 82, 22)) * 32}px)`,
        }}
      >
        SCHEDULE
        <br />
        FIRES
      </h2>
    </AbsoluteFill>
  )
}

function RunCalendarTask({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: AutonomousRunFilmLayout
}) {
  const scene = sceneOpacity(frame, 124, 228, 14)
  const enter = appear(frame, 136, 26)
  const sweep = ease(frame, 156, 208, [0, 1])
  const isWide = aspect === '16x9'
  const calendarRows = isWide
    ? (['focus', 'client-call', 'review'] as const)
    : (['focus', 'client-call', 'review', 'planning'] as const)
  const calendarMarkerSize = Math.max(22, layout.monoSize * 1.2)
  const calendarLineHeight = Math.max(9, layout.monoSize * 0.52)
  const calendarInset = layout.edge * (isWide ? 0.82 : 0.74)

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#000000',
          bottom: calendarInset,
          color: '#ffffff',
          left: calendarInset,
          overflow: 'hidden',
          padding: layout.edge * 0.68,
          position: 'absolute',
          right: isWide ? '29%' : calendarInset,
          top: calendarInset,
          transform: `translateX(${(1 - enter) * -110}px) scale(${0.94 + enter * 0.06})`,
          transformOrigin: 'left center',
        }}
      >
        <h2
          style={{
            fontSize: layout.taskSize * 1.06,
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 0.84,
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          CHECK
          <br />
          CALENDAR
        </h2>
        <div
          style={{
            display: 'grid',
            gap: layout.edge * 0.24,
            marginTop: layout.edge * 0.82,
          }}
        >
          {calendarRows.map((calendarRow, index) => {
            const row = appear(frame, 164 + index * 10, 14)
            const active = index === 1 || index === calendarRows.length - 1

            return (
              <div
                key={calendarRow}
                style={{
                  alignItems: 'center',
                  display: 'grid',
                  gap: layout.edge * 0.24,
                  gridTemplateColumns: 'auto 1fr',
                  opacity: row,
                  transform: `translateX(${(1 - row) * -28}px) scale(${active ? 1 + sweep * 0.035 : 1})`,
                  transformOrigin: 'left center',
                }}
              >
                <div
                  style={{
                    background: active ? '#ff3000' : '#ffffff',
                    height: calendarMarkerSize,
                    transform: `scale(${active ? 0.86 + sweep * 0.14 : 1})`,
                    width: calendarMarkerSize,
                  }}
                />
                <div
                  style={{
                    background: active ? '#ff3000' : '#ffffff',
                    height: calendarLineHeight,
                    opacity: active ? 1 : 0.52,
                    transform: `scaleX(${row})`,
                    transformOrigin: 'left',
                    width: `${active ? 82 : 62}%`,
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div
        style={{
          background: '#ff3000',
          bottom: calendarInset,
          position: 'absolute',
          right: isWide ? calendarInset : layout.edge,
          top: calendarInset,
          transform: `scaleY(${sweep})`,
          transformOrigin: 'top',
          width: Math.max(12, layout.monoSize * 0.68),
        }}
      />
    </AbsoluteFill>
  )
}

function RunFollowUpsTask({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: AutonomousRunFilmLayout
}) {
  const scene = sceneOpacity(frame, 208, 318, 14)
  const enter = appear(frame, 220, 22)
  const active = ease(frame, 248, 294, [0, 1])
  const isWide = aspect === '16x9'
  const panelInset = layout.edge * 0.72

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#000000',
          bottom: panelInset,
          color: '#ffffff',
          left: isWide ? '24%' : panelInset,
          overflow: 'hidden',
          padding: layout.edge * 0.66,
          position: 'absolute',
          right: panelInset,
          top: isWide ? panelInset : layout.edge * 1.02,
          transform: `translateX(${(1 - enter) * 96}px) scale(${0.95 + enter * 0.05})`,
        }}
      >
        <h2
          style={{
            fontSize: layout.taskSize * (isWide ? 1 : 0.88),
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 0.84,
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          FIND
          <br />
          FOLLOW-UPS
        </h2>
        <div
          style={{
            display: 'grid',
            gap: layout.edge * 0.16,
            marginTop: layout.edge * 0.56,
          }}
        >
          {['OPEN LOOP', 'WAITING', 'NEXT STEP'].map((item, index) => {
            const row = appear(frame, 242 + index * 12, 14)
            const selected = index === 0

            return (
              <div
                key={item}
                style={{
                  alignItems: 'center',
                  background: selected ? '#ff3000' : '#ffffff',
                  color: '#000000',
                  display: 'grid',
                  fontFamily: 'var(--font-mono)',
                  fontSize: layout.microSize * 1.08,
                  fontWeight: 900,
                  gridTemplateColumns: '1fr auto',
                  letterSpacing: '0.1em',
                  opacity: row,
                  padding: `${layout.edge * 0.21}px ${layout.edge * 0.28}px`,
                  textTransform: 'uppercase',
                  transform: `translateX(${(1 - row) * -38}px) scale(${selected ? 1 + active * 0.045 : 1})`,
                  transformOrigin: 'left center',
                }}
              >
                <span>{item}</span>
                <span>{selected ? '02' : `0${index}`}</span>
              </div>
            )
          })}
        </div>
        <strong
          style={{
            color: '#ff3000',
            display: 'block',
            fontFamily: 'var(--font-mono)',
            fontSize: layout.captionSize * 1.18,
            fontWeight: 950,
            letterSpacing: '0.14em',
            marginTop: layout.edge * 0.42,
            opacity: active,
            textTransform: 'uppercase',
          }}
        >
          2 OPEN LOOPS
        </strong>
      </div>
    </AbsoluteFill>
  )
}

function RunBriefTask({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: AutonomousRunFilmLayout
}) {
  const scene = sceneOpacity(frame, 300, 394, 14)
  const enter = appear(frame, 312, 24)
  const send = ease(frame, 338, 378, [0, 1])
  const isWide = aspect === '16x9'

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#000000',
          color: '#ffffff',
          left: '50%',
          minHeight: isWide ? 500 : 570,
          overflow: 'hidden',
          padding: layout.edge * 0.7,
          position: 'absolute',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${0.9 + enter * 0.1})`,
          width: isWide ? '62%' : '84%',
        }}
      >
        <h2
          style={{
            fontSize: layout.taskSize * (isWide ? 1.04 : 0.9),
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 0.84,
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          SEND
          <br />A BRIEF
        </h2>
        <div
          style={{
            display: 'grid',
            gap: layout.edge * 0.2,
            marginTop: layout.edge * 0.66,
          }}
        >
          {[0.86, 0.68, 0.78].map((width, index) => {
            const row = appear(frame, 330 + index * 10, 12)

            return (
              <div
                key={`brief-line-${width}`}
                style={{
                  background: '#ffffff',
                  height: Math.max(10, layout.monoSize * 0.56),
                  opacity: row * (index === 1 ? 0.6 : 0.9),
                  transform: `scaleX(${row})`,
                  transformOrigin: 'left',
                  width: `${width * 100}%`,
                }}
              />
            )
          })}
        </div>
        <div
          style={{
            background: '#ff3000',
            bottom: 0,
            height: Math.max(14, layout.monoSize * 0.82),
            left: 0,
            position: 'absolute',
            transform: `scaleX(${send})`,
            transformOrigin: 'left',
            width: '100%',
          }}
        />
      </div>
    </AbsoluteFill>
  )
}

function RunMemoryUpdate({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: AutonomousRunFilmLayout
}) {
  const scene = sceneOpacity(frame, 374, 464, 14)
  const enter = appear(frame, 388, 24)
  const link = ease(frame, 410, 446, [0, 1])
  const isWide = aspect === '16x9'
  const rows = ['TODAY', 'FOLLOW-UPS', 'CONTEXT'] as const

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <h2
        style={{
          color: '#000000',
          fontSize: layout.taskSize * (isWide ? 0.9 : 0.72),
          fontWeight: 950,
          left: layout.edge,
          letterSpacing: 0,
          lineHeight: 0.86,
          margin: 0,
          opacity: enter,
          position: 'absolute',
          textTransform: 'uppercase',
          top: layout.edge,
          transform: `translateY(${(1 - enter) * 30}px)`,
        }}
      >
        MEMORY
        <br />
        UPDATES
      </h2>
      <div
        style={{
          display: 'grid',
          gap: layout.edge * 0.22,
          position: 'absolute',
          right: layout.edge * 0.74,
          top: isWide ? layout.edge * 1.28 : layout.edge * 3.88,
          width: isWide ? '55%' : '82%',
        }}
      >
        {rows.map((row, index) => {
          const rowIn = appear(frame, 398 + index * 10, 14)
          const active = index === 1

          return (
            <div
              key={row}
              style={{
                alignItems: 'center',
                background: active ? '#ff3000' : '#000000',
                color: active ? '#000000' : '#ffffff',
                display: 'grid',
                fontSize: layout.captionSize * 1.42,
                fontWeight: 950,
                gridTemplateColumns: 'auto 1fr',
                opacity: rowIn,
                padding: `${layout.edge * 0.3}px ${layout.edge * 0.38}px`,
                textTransform: 'uppercase',
                transform: `translateX(${(1 - rowIn) * 46}px)`,
              }}
            >
              <span
                style={{
                  background: active ? '#000000' : '#ffffff',
                  display: 'block',
                  height: Math.max(18, layout.monoSize),
                  marginRight: 20,
                  width: Math.max(18, layout.monoSize),
                }}
              />
              <span>{row}</span>
            </div>
          )
        })}
      </div>
      <div
        style={{
          background: '#ff3000',
          bottom: layout.edge,
          height: Math.max(7, layout.monoSize * 0.42),
          left: layout.edge,
          position: 'absolute',
          transform: `scaleX(${link})`,
          transformOrigin: 'left',
          width: isWide ? '52%' : '64%',
        }}
      />
    </AbsoluteFill>
  )
}

function RunNextRun({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: AutonomousRunFilmLayout
}) {
  const scene = sceneOpacity(frame, 448, 506, 10)
  const enter = appear(frame, 456, 18)
  const isWide = aspect === '16x9'

  return (
    <AbsoluteFill
      style={{
        background: '#000000',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          height: 5,
          left: layout.edge,
          position: 'absolute',
          right: layout.edge,
          top: isWide ? '64%' : '66%',
          transform: `scaleX(${enter})`,
          transformOrigin: 'center',
        }}
      />
      {[0.26, 0.42, 0.68].map((left, index) => (
        <div
          key={`next-marker-${left}`}
          style={{
            background: index === 2 ? '#ff3000' : '#ffffff',
            height: layout.edge * (index === 2 ? 0.92 : 0.62),
            left: `${left * 100}%`,
            opacity: enter,
            position: 'absolute',
            top: isWide ? '64%' : '66%',
            transform: `translate(-50%, -50%) scaleY(${enter})`,
            width: index === 2 ? Math.max(16, layout.monoSize * 0.86) : 10,
          }}
        />
      ))}
      <h2
        style={{
          color: '#ffffff',
          fontSize: layout.thesisSize * (isWide ? 0.74 : 0.66),
          fontWeight: 950,
          left: '50%',
          letterSpacing: 0,
          lineHeight: 0.86,
          margin: 0,
          opacity: enter,
          position: 'absolute',
          textAlign: 'center',
          textTransform: 'uppercase',
          top: isWide ? '35%' : '38%',
          transform: `translate(-50%, -50%) translateY(${(1 - enter) * 26}px)`,
          whiteSpace: 'nowrap',
        }}
      >
        NEXT RUN
        <br />
        <span style={{ color: '#ff3000' }}>STARTS AHEAD</span>
      </h2>
    </AbsoluteFill>
  )
}

function MemoryOverTimeFilm({
  aspect,
  frame,
}: {
  aspect: LaunchVideoAspect
  frame: number
}) {
  const layout = getMemoryFilmLayout(aspect)

  return (
    <AbsoluteFill
      className="outname-video-root"
      style={{
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <MemoryRunOne aspect={aspect} frame={frame} layout={layout} />
      <MemoryFilesEnter aspect={aspect} frame={frame} layout={layout} />
      <MemoryStateChanges aspect={aspect} frame={frame} layout={layout} />
      <MemoryDreaming aspect={aspect} frame={frame} layout={layout} />
      <MemoryRunTwo aspect={aspect} frame={frame} layout={layout} />
      <MemoryLearningClose aspect={aspect} frame={frame} layout={layout} />
      <FilmEndCard
        aspect={aspect}
        endFrame={540}
        enterFrame={506}
        frame={frame}
        layout={layout}
        startFrame={486}
      />
    </AbsoluteFill>
  )
}

function MemoryRunOne({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: MemoryFilmLayout
}) {
  const scene = sceneOpacity(frame, 0, 78, 12)
  const enter = appear(frame, 4, 26)
  const drift = ease(frame, 28, 70, [0, 1])
  const isWide = aspect === '16x9'

  return (
    <AbsoluteFill
      style={{
        background: '#000000',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          color: '#000000',
          height: isWide ? '56%' : '48%',
          left: '50%',
          overflow: 'hidden',
          padding: layout.edge * 0.68,
          position: 'absolute',
          top: '50%',
          transform: `translate(-50%, -50%) translateX(${(1 - enter) * 480 - drift * (isWide ? 120 : 76)}px) scale(${1.08 - drift * 0.04})`,
          transformOrigin: 'center',
          width: isWide ? '64%' : '82%',
        }}
      >
        <div
          style={{
            background: '#ff3000',
            bottom: 0,
            left: 0,
            position: 'absolute',
            top: 0,
            transform: `scaleY(${enter})`,
            transformOrigin: 'top',
            width: Math.max(12, layout.monoSize * 0.68),
          }}
        />
        <strong
          style={{
            display: 'block',
            fontFamily: 'var(--font-mono)',
            fontSize: layout.giantSize * (isWide ? 0.68 : 0.72),
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 0.92,
            marginLeft: layout.edge * 0.36,
            textTransform: 'uppercase',
          }}
        >
          RUN 01
        </strong>
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-mono)',
            fontSize: layout.microSize,
            fontWeight: 900,
            letterSpacing: '0.14em',
            marginLeft: layout.edge * 0.42,
            marginTop: layout.edge * 0.34,
            textTransform: 'uppercase',
          }}
        >
          starts with what it knows
        </span>
      </div>
    </AbsoluteFill>
  )
}

function MemoryFilesEnter({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: MemoryFilmLayout
}) {
  const scene = sceneOpacity(frame, 52, 166, 14)
  const isWide = aspect === '16x9'
  const files = [
    { accent: '#ff3000', label: 'MEMORY', x: isWide ? -20 : -10, y: -20 },
    { accent: '#ffffff', label: 'TASKS', x: isWide ? 2 : 4, y: 2 },
    { accent: '#ff3000', label: 'GOAL', x: isWide ? 24 : 15, y: 24 },
  ] as const

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      {files.map((file, index) => {
        const fileIn = appear(frame, 62 + index * 18, 20)
        const focus = ease(frame, 98 + index * 8, 154, [0, 1])
        const direction = index === 1 ? 1 : -1

        return (
          <MemoryStateFile
            accent={file.accent}
            background={index === 1 ? '#ff3000' : '#000000'}
            color={index === 1 ? '#000000' : '#ffffff'}
            frame={frame}
            key={file.label}
            label={file.label}
            lineColor={index === 1 ? '#000000' : '#ffffff'}
            lineProgress={fileIn}
            style={{
              left: `${50 + file.x}%`,
              minHeight: layout.edge * (isWide ? 3.32 : 3.46),
              opacity: fileIn,
              padding: layout.edge * 0.52,
              position: 'absolute',
              top: `${50 + file.y}%`,
              transform: `translate(-50%, -50%) translateX(${(1 - fileIn) * direction * 520}px) rotate(${(index - 1) * 3 + (1 - fileIn) * direction * 8}deg) scale(${0.96 + focus * 0.06})`,
              transformOrigin: 'center',
              width: isWide ? '40%' : '78%',
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

function MemoryStateChanges({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: MemoryFilmLayout
}) {
  const scene = sceneOpacity(frame, 138, 248, 14)
  const enter = appear(frame, 148, 22)
  const sweep = ease(frame, 168, 228, [0, 1])
  const isWide = aspect === '16x9'
  const rows = ['MEMORY', 'TASKS', 'GOAL'] as const

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <h2
        style={{
          color: '#000000',
          fontSize: layout.fileSize * (isWide ? 0.92 : 0.78),
          fontWeight: 950,
          left: layout.edge,
          letterSpacing: 0,
          lineHeight: 0.84,
          margin: 0,
          opacity: enter,
          position: 'absolute',
          textTransform: 'uppercase',
          top: layout.edge,
          transform: `translateY(${(1 - enter) * 34}px)`,
        }}
      >
        STATE
        <br />
        CHANGES
      </h2>
      <span
        style={{
          color: '#ff3000',
          fontFamily: 'var(--font-mono)',
          fontSize: layout.microSize,
          fontWeight: 900,
          left: layout.edge,
          letterSpacing: '0.14em',
          opacity: enter,
          position: 'absolute',
          textTransform: 'uppercase',
          top: layout.edge + layout.fileSize * (isWide ? 1.7 : 1.48),
        }}
      >
        memory / tasks / goal
      </span>
      <div
        style={{
          background: '#000000',
          bottom: layout.edge * 0.72,
          left: isWide ? '42%' : layout.edge * 0.72,
          overflow: 'hidden',
          padding: layout.edge * 0.5,
          position: 'absolute',
          right: layout.edge * 0.72,
          top: isWide ? layout.edge * 0.72 : '42%',
          transform: `translateX(${(1 - enter) * 72}px) scale(${0.95 + enter * 0.05})`,
          transformOrigin: 'center',
        }}
      >
        {rows.map((row, index) => {
          const rowIn = appear(frame, 160 + index * 12, 16)
          const active = index === 1

          return (
            <div
              key={row}
              style={{
                alignItems: 'center',
                background: active ? '#ff3000' : '#ffffff',
                color: '#000000',
                display: 'grid',
                fontFamily: 'var(--font-mono)',
                fontSize: layout.captionSize * 1.18,
                fontWeight: 950,
                gridTemplateColumns: 'auto 1fr',
                marginBottom: layout.edge * 0.22,
                opacity: rowIn,
                padding: `${layout.edge * 0.2}px ${layout.edge * 0.26}px`,
                textTransform: 'uppercase',
                transform: `translateX(${(1 - rowIn) * 50}px)`,
              }}
            >
              <span
                style={{
                  background: active ? '#000000' : '#ff3000',
                  display: 'block',
                  height: Math.max(16, layout.monoSize * 0.9),
                  marginRight: layout.edge * 0.22,
                  width: Math.max(16, layout.monoSize * 0.9),
                }}
              />
              <span>{row}</span>
            </div>
          )
        })}
        <div
          style={{
            background: '#ff3000',
            bottom: 0,
            height: Math.max(12, layout.monoSize * 0.76),
            left: 0,
            position: 'absolute',
            transform: `scaleX(${sweep})`,
            transformOrigin: 'left',
            width: '100%',
          }}
        />
      </div>
    </AbsoluteFill>
  )
}

function MemoryDreaming({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: MemoryFilmLayout
}) {
  const scene = sceneOpacity(frame, 224, 336, 16)
  const enter = appear(frame, 236, 24)
  const consolidate = ease(frame, 256, 318, [0, 1])
  const isWide = aspect === '16x9'
  const fragments = [
    { label: 'MEMORY', x: -24, y: -22 },
    { label: 'TASKS', x: 18, y: -4 },
    { label: 'GOAL', x: -6, y: 22 },
  ] as const

  return (
    <AbsoluteFill
      style={{
        background: '#000000',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#ff3000',
          bottom: layout.edge,
          left: '50%',
          position: 'absolute',
          top: layout.edge,
          transform: `translateX(-50%) scaleY(${0.12 + consolidate * 0.88}) scaleX(${1 + consolidate * 0.24})`,
          transformOrigin: 'center',
          width: Math.max(18, layout.monoSize),
        }}
      />
      {fragments.map((fragment, index) => {
        const inFrame = appear(frame, 238 + index * 8, 18)
        const left = 50 + fragment.x * (1 - consolidate)
        const top = 50 + fragment.y * (1 - consolidate)
        const fragmentFade = Math.max(0, 1 - consolidate * 2.2)

        return (
          <div
            key={fragment.label}
            style={{
              background: '#ffffff',
              color: '#000000',
              fontFamily: 'var(--font-mono)',
              fontSize: layout.microSize,
              fontWeight: 950,
              left: `${left}%`,
              letterSpacing: '0.12em',
              opacity: inFrame * fragmentFade,
              padding: `${layout.edge * 0.16}px ${layout.edge * 0.26}px`,
              position: 'absolute',
              textTransform: 'uppercase',
              top: `${top}%`,
              transform: `translate(-50%, -50%) rotate(${(index - 1) * 5 * (1 - consolidate)}deg) scale(${1 - consolidate * 0.18})`,
              transformOrigin: 'center',
            }}
          >
            {fragment.label}
          </div>
        )
      })}
      <div
        style={{
          color: '#ffffff',
          left: '50%',
          opacity: enter,
          position: 'absolute',
          textAlign: 'center',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${0.94 + consolidate * 0.08})`,
          width: isWide ? '64%' : '82%',
        }}
      >
        <h2
          style={{
            fontSize: layout.giantSize * (isWide ? 0.72 : 0.74),
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 0.84,
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          DREAMING
        </h2>
        <p
          style={{
            background: '#000000',
            color: '#ff3000',
            display: 'inline-block',
            fontFamily: 'var(--font-mono)',
            fontSize: layout.microSize,
            fontWeight: 900,
            letterSpacing: '0.14em',
            margin: `${layout.edge * 0.34}px 0 0`,
            padding: `0 ${layout.edge * 0.18}px`,
            textTransform: 'uppercase',
          }}
        >
          the agent consolidates
        </p>
      </div>
    </AbsoluteFill>
  )
}

function MemoryRunTwo({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: MemoryFilmLayout
}) {
  const scene = sceneOpacity(frame, 312, 432, 14)
  const enter = appear(frame, 324, 24)
  const settle = ease(frame, 350, 414, [0, 1])
  const isWide = aspect === '16x9'
  const rows = ['MEMORY', 'TASKS', 'GOAL'] as const

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <div
        style={{
          color: '#000000',
          left: layout.edge,
          opacity: enter,
          position: 'absolute',
          top: layout.edge,
          transform: `translateY(${(1 - enter) * 30}px)`,
        }}
      >
        <strong
          style={{
            display: 'block',
            fontFamily: 'var(--font-mono)',
            fontSize: layout.fileSize * (isWide ? 0.82 : 0.72),
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 0.86,
            textTransform: 'uppercase',
          }}
        >
          RUN 02
        </strong>
        <span
          style={{
            color: '#ff3000',
            display: 'block',
            fontFamily: 'var(--font-mono)',
            fontSize: layout.microSize,
            fontWeight: 900,
            letterSpacing: '0.14em',
            marginTop: layout.edge * 0.22,
            textTransform: 'uppercase',
          }}
        >
          starts from updated state
        </span>
      </div>
      <div
        style={{
          background: '#000000',
          bottom: isWide ? layout.edge : layout.edge * 0.86,
          left: isWide ? '40%' : layout.edge * 0.72,
          overflow: 'hidden',
          padding: layout.edge * 0.46,
          position: 'absolute',
          right: layout.edge * 0.72,
          top: isWide ? layout.edge : layout.edge * 3.26,
          transform: `translateX(${(1 - enter) * 88}px) scale(${0.96 + settle * 0.04})`,
          transformOrigin: 'center',
        }}
      >
        {rows.map((row, index) => {
          const rowIn = appear(frame, 346 + index * 12, 16)
          const selected = index === 0

          return (
            <div
              key={row}
              style={{
                alignItems: 'center',
                background: selected ? '#ff3000' : '#ffffff',
                color: '#000000',
                display: 'grid',
                fontFamily: 'var(--font-mono)',
                fontSize: layout.captionSize * 1.16,
                fontWeight: 950,
                gridTemplateColumns: 'auto 1fr',
                marginBottom: layout.edge * 0.2,
                opacity: rowIn,
                padding: `${layout.edge * 0.22}px ${layout.edge * 0.3}px`,
                textTransform: 'uppercase',
                transform: `translateX(${(1 - rowIn) * -46}px)`,
              }}
            >
              <span
                style={{
                  background: selected ? '#000000' : '#ff3000',
                  display: 'block',
                  height: Math.max(17, layout.monoSize * 0.95),
                  marginRight: layout.edge * 0.2,
                  width: Math.max(17, layout.monoSize * 0.95),
                }}
              />
              <span>{row}</span>
            </div>
          )
        })}
        <div
          style={{
            background: '#ff3000',
            bottom: 0,
            height: Math.max(12, layout.monoSize * 0.76),
            left: 0,
            position: 'absolute',
            transform: `scaleX(${settle})`,
            transformOrigin: 'left',
            width: '100%',
          }}
        />
      </div>
    </AbsoluteFill>
  )
}

function MemoryLearningClose({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: MemoryFilmLayout
}) {
  const scene = sceneOpacity(frame, 406, 502, 14)
  const enter = appear(frame, 418, 24)
  const lock = ease(frame, 430, 486, [0, 1])
  const isWide = aspect === '16x9'

  return (
    <AbsoluteFill
      style={{
        background: '#000000',
        opacity: scene,
      }}
    >
      {['MEMORY', 'TASKS', 'GOAL'].map((item, index) => {
        const itemIn = appear(frame, 414 + index * 8, 18)

        return (
          <div
            key={item}
            style={{
              background: index === 1 ? '#ff3000' : '#ffffff',
              height: Math.max(18, layout.monoSize),
              left: `${16 + index * 15 + lock * (22 - index * 9)}%`,
              opacity: itemIn * (1 - lock * 0.28),
              position: 'absolute',
              top: `${68 - index * 8 + lock * (4 + index * 2)}%`,
              transform: `scaleX(${0.58 + lock * 1.1})`,
              transformOrigin: 'left',
              width: isWide ? '28%' : '34%',
            }}
          />
        )
      })}
      <h2
        style={{
          color: '#ffffff',
          fontSize: layout.thesisSize * (isWide ? 0.78 : 0.78),
          fontWeight: 950,
          left: '50%',
          letterSpacing: 0,
          lineHeight: 0.84,
          margin: 0,
          opacity: enter,
          position: 'absolute',
          textAlign: 'center',
          textTransform: 'uppercase',
          top: '46%',
          transform: `translate(-50%, -50%) translateY(${(1 - enter) * 30}px) scale(${0.96 + lock * 0.04})`,
          width: isWide ? '72%' : '86%',
        }}
      >
        AGENTS THAT
        <br />
        <span style={{ color: '#ff3000' }}>KEEP</span>
        <br />
        LEARNING
      </h2>
    </AbsoluteFill>
  )
}

function MemoryStateFile({
  accent,
  background,
  color,
  frame,
  label,
  lineColor,
  lineProgress,
  style,
}: {
  accent: string
  background: string
  color: string
  frame: number
  label: string
  lineColor: string
  lineProgress: number
  style: CSSProperties
}) {
  const widths = [0.86, 0.64, 0.74] as const

  return (
    <div
      style={{
        background,
        color,
        minHeight: 210,
        overflow: 'hidden',
        padding: 34,
        ...style,
      }}
    >
      <div
        style={{
          background: accent,
          height: 12,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
          transform: `scaleX(${lineProgress})`,
          transformOrigin: 'left',
        }}
      />
      <strong
        style={{
          display: 'block',
          fontSize: 54,
          fontWeight: 950,
          letterSpacing: 0,
          lineHeight: 0.86,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </strong>
      <div
        style={{
          display: 'grid',
          gap: 13,
          marginTop: 34,
        }}
      >
        {widths.map((width, index) => {
          const line = appear(frame, 78 + index * 8, 12)

          return (
            <div
              key={`${label}-line-${width}`}
              style={{
                background: lineColor,
                height: index === 1 ? 8 : 11,
                opacity: line * (index === 1 ? 0.48 : 0.82),
                transform: `scaleX(${lineProgress})`,
                transformOrigin: 'left',
                width: `${width * 100}%`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

function ComposableChannelsFilm({
  aspect,
  frame,
}: {
  aspect: LaunchVideoAspect
  frame: number
}) {
  const layout = getComposableFilmLayout(aspect)

  return (
    <AbsoluteFill
      className="outname-video-root"
      style={{
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <ComposableCoreOpen aspect={aspect} frame={frame} layout={layout} />
      <ComposableToolsAttach aspect={aspect} frame={frame} layout={layout} />
      <ComposableSubagentSplit aspect={aspect} frame={frame} layout={layout} />
      <ComposableChannelDoors aspect={aspect} frame={frame} layout={layout} />
      <ComposableFutureSurfaces aspect={aspect} frame={frame} layout={layout} />
      <ComposablePayoff aspect={aspect} frame={frame} layout={layout} />
      <FilmEndCard
        aspect={aspect}
        endFrame={540}
        enterFrame={514}
        frame={frame}
        layout={layout}
        startFrame={496}
      />
    </AbsoluteFill>
  )
}

function ComposableCoreOpen({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: ComposableFilmLayout
}) {
  const scene = sceneOpacity(frame, 0, 92, 12)
  const enter = appear(frame, 4, 24)
  const drift = ease(frame, 18, 84, [0, 1])
  const isWide = aspect === '16x9'

  return (
    <AbsoluteFill
      style={{
        background: '#000000',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          color: '#000000',
          height: isWide ? '62%' : '46%',
          left: '50%',
          overflow: 'hidden',
          padding: layout.edge * 0.68,
          position: 'absolute',
          top: '52%',
          transform: `translate(-50%, -50%) translateX(${(1 - enter) * 520 - drift * (isWide ? 150 : 84)}px) scale(${1.12 - drift * 0.05})`,
          transformOrigin: 'center',
          width: isWide ? '62%' : '82%',
        }}
      >
        <div
          style={{
            background: '#ff3000',
            bottom: 0,
            left: 0,
            position: 'absolute',
            top: 0,
            transform: `scaleY(${enter})`,
            transformOrigin: 'top',
            width: Math.max(12, layout.monoSize * 0.72),
          }}
        />
        <strong
          style={{
            display: 'block',
            fontSize: layout.giantSize * (isWide ? 0.62 : 0.7),
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 0.86,
            marginLeft: layout.edge * 0.4,
            textTransform: 'uppercase',
          }}
        >
          ONE
          <br />
          AGENT
        </strong>
        <span
          style={{
            color: '#ff3000',
            display: 'block',
            fontFamily: 'var(--font-mono)',
            fontSize: layout.smallSize,
            fontWeight: 900,
            letterSpacing: '0.16em',
            marginLeft: layout.edge * 0.42,
            marginTop: layout.edge * 0.34,
            textTransform: 'uppercase',
          }}
        >
          composable by design
        </span>
      </div>
    </AbsoluteFill>
  )
}

function ComposableToolsAttach({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: ComposableFilmLayout
}) {
  const scene = sceneOpacity(frame, 58, 184, 16)
  const titleIn = appear(frame, 68, 18)
  const coreIn = appear(frame, 86, 20)
  const isWide = aspect === '16x9'
  const tools = [
    { accent: true, label: 'RESEND', rotation: -3, x: -30, y: -25 },
    { accent: false, label: 'PARALLEL', rotation: 3, x: 29, y: -17 },
    { accent: false, label: 'AGENT BROWSER', rotation: -2, x: -24, y: 28 },
    { accent: true, label: 'GITHUB', rotation: 4, x: 30, y: 23 },
  ] as const

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <h2
        style={{
          color: '#000000',
          fontSize: layout.thesisSize * (isWide ? 0.72 : 0.76),
          fontWeight: 950,
          left: layout.edge,
          letterSpacing: 0,
          lineHeight: 0.84,
          margin: 0,
          opacity: titleIn,
          position: 'absolute',
          textTransform: 'uppercase',
          top: layout.edge,
          transform: `translateY(${(1 - titleIn) * 32}px)`,
          width: isWide ? '48%' : '78%',
        }}
      >
        GIVE IT
        <br />
        <span style={{ color: '#ff3000' }}>TOOLS</span>
      </h2>
      <div
        style={{
          background: '#000000',
          height: isWide ? layout.edge * 2.1 : layout.edge * 2,
          left: '50%',
          position: 'absolute',
          top: isWide ? '55%' : '53%',
          transform: `translate(-50%, -50%) scale(${0.76 + coreIn * 0.24}) rotate(${(1 - coreIn) * -4}deg)`,
          transformOrigin: 'center',
          width: isWide ? layout.edge * 3.7 : layout.edge * 3.25,
        }}
      >
        <div
          style={{
            background: '#ff3000',
            bottom: 0,
            left: 0,
            position: 'absolute',
            top: 0,
            transform: `scaleY(${coreIn})`,
            transformOrigin: 'bottom',
            width: Math.max(12, layout.monoSize * 0.72),
          }}
        />
      </div>
      {tools.map((tool, index) => {
        const inFrame = appear(frame, 92 + index * 12, 18)
        const lock = ease(frame, 116 + index * 8, 170, [0, 1])
        const x = tool.x * (1 - lock * 0.42)
        const y = tool.y * (1 - lock * 0.42)
        const fromX = tool.x > 0 ? 340 : -340
        const fromY = tool.y > 0 ? 180 : -180

        return (
          <ComposableModule
            accent={tool.accent}
            frame={frame}
            key={tool.label}
            label={tool.label}
            layout={layout}
            style={{
              left: `${50 + x}%`,
              minWidth: tool.label === 'AGENT BROWSER' ? '38%' : '28%',
              opacity: inFrame,
              top: `${(isWide ? 54 : 55) + y}%`,
              transform: `translate(-50%, -50%) translate(${(1 - inFrame) * fromX}px, ${(1 - inFrame) * fromY}px) rotate(${tool.rotation * (1 - lock * 0.4)}deg) scale(${0.9 + lock * 0.13})`,
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

function ComposableSubagentSplit({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: ComposableFilmLayout
}) {
  const scene = sceneOpacity(frame, 154, 278, 16)
  const titleIn = appear(frame, 166, 20)
  const split = ease(frame, 184, 262, [0, 1])
  const isWide = aspect === '16x9'
  const panels = [
    { label: 'PARENT', tone: 'dark', x: 0, y: 0 },
    { label: 'SUBAGENT 01', tone: 'light', x: isWide ? -28 : -21, y: 23 },
    { label: 'SUBAGENT 02', tone: 'red', x: isWide ? 29 : 22, y: -22 },
  ] as const

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <h2
        style={{
          color: '#000000',
          fontSize: layout.thesisSize * (isWide ? 0.74 : 0.74),
          fontWeight: 950,
          left: layout.edge,
          letterSpacing: 0,
          lineHeight: 0.84,
          margin: 0,
          opacity: titleIn,
          position: 'absolute',
          textTransform: 'uppercase',
          top: layout.edge,
          transform: `translateY(${(1 - titleIn) * 34}px)`,
          width: isWide ? '54%' : '82%',
        }}
      >
        SPLIT
        <br />
        THE WORK
      </h2>
      {panels.map((panel, index) => (
        <ComposableSubagentPanel
          frame={frame}
          index={index}
          isWide={isWide}
          key={panel.label}
          layout={layout}
          panel={panel}
          split={split}
        />
      ))}
    </AbsoluteFill>
  )
}

function ComposableSubagentPanel({
  frame,
  index,
  isWide,
  layout,
  panel,
  split,
}: {
  frame: number
  index: number
  isWide: boolean
  layout: ComposableFilmLayout
  panel: {
    label: string
    tone: 'dark' | 'light' | 'red'
    x: number
    y: number
  }
  split: number
}) {
  const panelIn = appear(frame, 178 + index * 12, 18)
  const x = panel.x * split
  const y = panel.y * split
  const isParent = panel.label === 'PARENT'
  const background = getComposablePanelBackground(panel.tone)
  const color = panel.tone === 'dark' ? '#ffffff' : '#000000'
  const panelHeight = isParent ? layout.edge * 2.35 : layout.edge * 1.9
  const panelScale = isParent ? 1.08 - split * 0.08 : 0.78 + split * 0.22
  const top = isWide ? 58 : 58 + y
  const verticalShift = isWide ? y * 0.5 : 0

  return (
    <div
      style={{
        background,
        border: `${Math.max(4, layout.monoSize * 0.24)}px solid #000000`,
        color,
        height: panelHeight,
        left: `${50 + x}%`,
        opacity: panelIn,
        padding: layout.edge * 0.36,
        position: 'absolute',
        top: `${top}%`,
        transform: `translate(-50%, -50%) translateY(${verticalShift}%) rotate(${(index - 1) * 3 * split}deg) scale(${panelScale})`,
        transformOrigin: 'center',
        width: getComposableSubagentPanelWidth(isParent, isWide),
        zIndex: isParent ? 3 : 2,
      }}
    >
      <strong
        style={{
          display: 'block',
          fontFamily: 'var(--font-mono)',
          fontSize: layout.chipSize * (isParent ? 0.82 : 0.72),
          fontWeight: 950,
          letterSpacing: '0.03em',
          lineHeight: 0.92,
          textTransform: 'uppercase',
        }}
      >
        {panel.label}
      </strong>
      <div
        style={{
          background: panel.tone === 'red' ? '#000000' : '#ff3000',
          height: Math.max(10, layout.monoSize * 0.62),
          marginTop: layout.edge * 0.34,
          transform: `scaleX(${split})`,
          transformOrigin: 'left',
          width: '72%',
        }}
      />
    </div>
  )
}

function ComposableChannelDoors({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: ComposableFilmLayout
}) {
  const scene = sceneOpacity(frame, 246, 376, 16)
  const titleIn = appear(frame, 258, 20)
  const coreIn = appear(frame, 276, 20)
  const isWide = aspect === '16x9'
  const doors = [
    { accent: false, label: 'SLACK', side: 'left', y: 34 },
    { accent: true, label: 'TELEGRAM', side: 'right', y: 45 },
    { accent: false, label: 'DISCORD', side: 'left', y: 62 },
    { accent: true, label: 'WEBHOOKS', side: 'right', y: 73 },
  ] as const

  return (
    <AbsoluteFill
      style={{
        background: '#000000',
        opacity: scene,
      }}
    >
      <h2
        style={{
          color: '#ffffff',
          fontSize: layout.thesisSize * (isWide ? 0.72 : 0.72),
          fontWeight: 950,
          left: layout.edge,
          letterSpacing: 0,
          lineHeight: 0.84,
          margin: 0,
          opacity: titleIn,
          position: 'absolute',
          textTransform: 'uppercase',
          top: layout.edge,
          transform: `translateY(${(1 - titleIn) * 30}px)`,
        }}
      >
        OPEN
        <br />
        <span style={{ color: '#ff3000' }}>THE DOORS</span>
      </h2>
      <div
        style={{
          background: '#ffffff',
          height: layout.edge * 2.15,
          left: '50%',
          overflow: 'hidden',
          position: 'absolute',
          top: isWide ? '56%' : '54%',
          transform: `translate(-50%, -50%) scale(${0.82 + coreIn * 0.18})`,
          width: isWide ? layout.edge * 3.5 : layout.edge * 3.1,
          zIndex: 5,
        }}
      >
        <div
          style={{
            background: '#ff3000',
            bottom: 0,
            left: 0,
            position: 'absolute',
            top: 0,
            width: Math.max(12, layout.monoSize * 0.72),
          }}
        />
      </div>
      {doors.map((door, index) => {
        const doorIn = appear(frame, 280 + index * 10, 18)
        const lock = ease(frame, 302 + index * 8, 364, [0, 1])
        const from = door.side === 'left' ? -112 : 112
        const dock = door.side === 'left' ? -6 : 6

        return (
          <div
            key={door.label}
            style={{
              alignItems: 'center',
              background: door.accent ? '#ff3000' : '#ffffff',
              color: '#000000',
              display: 'flex',
              fontFamily: 'var(--font-mono)',
              fontSize: layout.channelSize,
              fontWeight: 950,
              height: layout.edge * (isWide ? 0.86 : 0.78),
              justifyContent: door.side === 'left' ? 'flex-end' : 'flex-start',
              left: '50%',
              letterSpacing: '0.08em',
              opacity: doorIn,
              padding: `0 ${layout.edge * 0.34}px`,
              position: 'absolute',
              textTransform: 'uppercase',
              top: `${door.y}%`,
              transform: `translate(-50%, -50%) translateX(${from * (1 - doorIn) + dock * lock}%)`,
              transformOrigin: 'center',
              width: isWide ? '58%' : '72%',
              zIndex: index === 1 ? 6 : 4,
            }}
          >
            {door.label}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

function ComposableFutureSurfaces({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: ComposableFilmLayout
}) {
  const scene = sceneOpacity(frame, 366, 462, 16)
  const enter = appear(frame, 374, 20)
  const activate = ease(frame, 394, 450, [0, 1])
  const isWide = aspect === '16x9'
  const slots = [
    { label: 'MCP', x: isWide ? -24 : -20, y: isWide ? 16 : 24 },
    { label: 'SKILLS', x: isWide ? 24 : 20, y: isWide ? -16 : -22 },
  ] as const

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <h2
        style={{
          color: '#000000',
          fontSize: layout.thesisSize * (isWide ? 0.66 : 0.68),
          fontWeight: 950,
          left: layout.edge,
          letterSpacing: 0,
          lineHeight: 0.84,
          margin: 0,
          opacity: enter,
          position: 'absolute',
          textTransform: 'uppercase',
          top: layout.edge,
          transform: `translateY(${(1 - enter) * 30}px)`,
          width: isWide ? '60%' : '84%',
        }}
      >
        MORE
        <br />
        SURFACES
      </h2>
      <span
        style={{
          color: '#ff3000',
          fontFamily: 'var(--font-mono)',
          fontSize: layout.smallSize,
          fontWeight: 900,
          left: layout.edge,
          letterSpacing: '0.16em',
          opacity: enter,
          position: 'absolute',
          textTransform: 'uppercase',
          top: layout.edge + layout.thesisSize * (isWide ? 1.18 : 1.26),
        }}
      >
        coming soon
      </span>
      <div
        style={{
          background: '#000000',
          bottom: layout.edge * 0.8,
          left: isWide ? '42%' : layout.edge * 0.72,
          overflow: 'hidden',
          position: 'absolute',
          right: layout.edge * 0.72,
          top: isWide ? layout.edge * 0.85 : '42%',
          transform: `translateX(${(1 - enter) * 74}px) scale(${0.95 + enter * 0.05})`,
          transformOrigin: 'center',
        }}
      >
        <div
          style={{
            background: '#ff3000',
            height: Math.max(12, layout.monoSize * 0.72),
            left: 0,
            position: 'absolute',
            top: 0,
            transform: `scaleX(${activate})`,
            transformOrigin: 'left',
            width: '100%',
          }}
        />
        {slots.map((slot, index) => {
          const slotIn = appear(frame, 386 + index * 18, 18)

          return (
            <div
              key={slot.label}
              style={{
                alignItems: 'center',
                border: `${Math.max(3, layout.monoSize * 0.2)}px dashed ${
                  index === 0 ? '#ff3000' : '#ffffff'
                }`,
                color: index === 0 ? '#ff3000' : '#ffffff',
                display: 'flex',
                fontFamily: 'var(--font-mono)',
                fontSize: layout.moduleSize,
                fontWeight: 950,
                height: layout.edge * (isWide ? 1.95 : 1.8),
                justifyContent: 'center',
                left: `${50 + slot.x * activate}%`,
                letterSpacing: '0.08em',
                opacity: slotIn * (0.45 + activate * 0.55),
                position: 'absolute',
                textTransform: 'uppercase',
                top: `${54 + slot.y * activate}%`,
                transform: `translate(-50%, -50%) rotate(${(index === 0 ? -2 : 2) * activate}deg) scale(${0.9 + activate * 0.1})`,
                transformOrigin: 'center',
                width: isWide ? '32%' : '52%',
              }}
            >
              {slot.label}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function ComposablePayoff({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: ComposableFilmLayout
}) {
  const scene = sceneOpacity(frame, 426, 508, 14)
  const enter = appear(frame, 436, 22)
  const lock = ease(frame, 446, 494, [0, 1])
  const isWide = aspect === '16x9'
  const pieces = [
    { color: '#ffffff', height: 0.48, width: 0.52, x: -18, y: 21 },
    { color: '#ff3000', height: 0.32, width: 0.46, x: 15, y: -18 },
    { color: '#ffffff', height: 0.24, width: 0.38, x: 22, y: 19 },
  ] as const

  return (
    <AbsoluteFill
      style={{
        background: '#000000',
        opacity: scene,
      }}
    >
      {pieces.map((piece, index) => {
        const pieceIn = appear(frame, 430 + index * 8, 16)

        return (
          <div
            key={`${piece.color}-${piece.x}-${piece.y}`}
            style={{
              background: piece.color,
              height: layout.edge * piece.height,
              left: `${50 + piece.x * (1 - lock * 0.72)}%`,
              opacity: pieceIn,
              position: 'absolute',
              top: `${62 + piece.y * (1 - lock * 0.56)}%`,
              transform: `translate(-50%, -50%) scaleX(${piece.width + lock * 0.72})`,
              transformOrigin: 'center',
              width: isWide ? '34%' : '48%',
            }}
          />
        )
      })}
      <h2
        style={{
          color: '#ffffff',
          fontSize: layout.thesisSize * (isWide ? 0.64 : 0.68),
          fontWeight: 950,
          left: '50%',
          letterSpacing: 0,
          lineHeight: 0.84,
          margin: 0,
          opacity: enter,
          position: 'absolute',
          textAlign: 'center',
          textTransform: 'uppercase',
          top: '43%',
          transform: `translate(-50%, -50%) translateY(${(1 - enter) * 28}px) scale(${0.96 + lock * 0.04})`,
          width: isWide ? '74%' : '88%',
        }}
      >
        BUILD THE AGENT
        <br />
        <span style={{ color: '#ff3000' }}>CONNECT</span>
        <br />
        THE SYSTEM
      </h2>
    </AbsoluteFill>
  )
}

function ComposableModule({
  accent,
  label,
  layout,
  style,
}: {
  accent: boolean
  frame: number
  label: string
  layout: ComposableFilmLayout
  style: CSSProperties
}) {
  return (
    <div
      style={{
        background: accent ? '#ff3000' : '#000000',
        color: accent ? '#000000' : '#ffffff',
        fontFamily: 'var(--font-mono)',
        fontSize: layout.chipSize,
        fontWeight: 950,
        letterSpacing: '0.06em',
        lineHeight: 1,
        padding: `${layout.edge * 0.28}px ${layout.edge * 0.34}px`,
        position: 'absolute',
        textAlign: 'center',
        textTransform: 'uppercase',
        transformOrigin: 'center',
        ...style,
      }}
    >
      {label}
    </div>
  )
}

function getComposablePanelBackground(tone: 'dark' | 'light' | 'red') {
  if (tone === 'dark') {
    return '#000000'
  }

  if (tone === 'red') {
    return '#ff3000'
  }

  return '#ffffff'
}

function getComposableSubagentPanelWidth(isParent: boolean, isWide: boolean) {
  if (isParent) {
    return isWide ? '31%' : '56%'
  }

  return isWide ? '28%' : '48%'
}

function ColdOpen({ frame, layout }: { frame: number; layout: WhyFilmLayout }) {
  const scene = sceneOpacity(frame, 0, 96, 12)
  const drift = ease(frame, 0, 90, [0, 1])
  const clockSize = layout.monoSize * 1.35

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#ff3000',
          height: clockSize * 1.2,
          left: layout.edge,
          opacity: 0.95,
          position: 'absolute',
          top: layout.edge - clockSize * 0.1,
          transform: `scaleY(${ease(frame, 4, 28, [0, 1])})`,
          transformOrigin: 'top',
          width: Math.max(7, layout.monoSize * 0.42),
        }}
      />
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: clockSize,
          fontWeight: 900,
          left: layout.edge + layout.monoSize * 1.35,
          letterSpacing: '0.16em',
          lineHeight: 1,
          position: 'absolute',
          top: layout.edge,
          transform: `translate3d(${drift * 18}px, ${drift * 12}px, 0) scale(${1 + drift * 0.18})`,
          transformOrigin: 'left top',
        }}
      >
        08:29
      </div>
      <div
        style={{
          background: '#ff3000',
          bottom: layout.edge,
          height: 4,
          left: layout.edge,
          opacity: ease(frame, 42, 82, [0, 1]) * 0.9,
          position: 'absolute',
          transform: `scaleX(${ease(frame, 42, 82, [0, 1])})`,
          transformOrigin: 'left',
          width: aspectLineWidth(layout),
        }}
      />
    </AbsoluteFill>
  )
}

function ContextFragments({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: WhyFilmLayout
}) {
  const scene = sceneOpacity(frame, 76, 202, 14)
  const pan = ease(frame, 82, 190, [0, 1])
  const isWide = aspect === '16x9'
  const fragments = [
    {
      delay: 86,
      text: 'WHERE WAS I?',
      x: isWide ? 28 : 86,
      y: layout.edge + (isWide ? 38 : 120),
    },
    {
      delay: 104,
      text: 'WHAT CHANGED?',
      x: isWide ? 620 : 210,
      y: isWide ? 390 : 460,
    },
    {
      delay: 122,
      text: "WHAT'S NEXT?",
      x: isWide ? 190 : 88,
      y: isWide ? 710 : 810,
    },
  ] as const

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#ff3000',
          height: layout.fragmentSize * 0.7,
          left: layout.edge,
          opacity: ease(frame, 82, 108, [0, 1]) * 0.95,
          position: 'absolute',
          top: layout.edge,
          transform: `scaleY(${ease(frame, 82, 118, [0, 1])})`,
          transformOrigin: 'top',
          width: Math.max(8, layout.monoSize * 0.5),
        }}
      />
      <div
        style={{
          height: '100%',
          transform: `translate3d(${pan * (isWide ? -72 : -42)}px, 0, 0)`,
          width: '100%',
        }}
      >
        {fragments.map((fragment, index) => {
          const inProgress = appear(frame, fragment.delay, 20)
          const localPan = ease(
            frame,
            fragment.delay,
            fragment.delay + 70,
            [0, 1]
          )

          return (
            <div
              key={fragment.text}
              style={{
                color: '#000000',
                fontSize: layout.fragmentSize,
                fontWeight: 950,
                left: fragment.x,
                letterSpacing: 0,
                lineHeight: 0.82,
                opacity: inProgress,
                position: 'absolute',
                textTransform: 'uppercase',
                top: fragment.y,
                transform: `translate3d(${(1 - inProgress) * 88 - localPan * 22}px, 0, 0) scale(${1 + localPan * 0.035})`,
                transformOrigin: index === 1 ? 'right center' : 'left center',
                whiteSpace: 'nowrap',
              }}
            >
              {fragment.text}
              {index === 2 ? (
                <div
                  style={{
                    background: '#ff3000',
                    height: Math.max(8, layout.monoSize * 0.55),
                    marginTop: layout.monoSize,
                    transform: `scaleX(${ease(frame, 146, 188, [0, 1])})`,
                    transformOrigin: 'left',
                    width: '64%',
                  }}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function ResetBeat({
  frame,
  layout,
}: {
  frame: number
  layout: WhyFilmLayout
}) {
  const scene = sceneOpacity(frame, 176, 294, 14)
  const hit = ease(frame, 188, 220, [0, 1])
  const release = ease(frame, 226, 284, [0, 1])

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        opacity: scene,
      }}
    >
      <div
        style={{
          maxWidth: '88%',
          transform: `scale(${1.22 - hit * 0.22 - release * 0.1}) translateY(${release * -44}px)`,
          transformOrigin: 'center',
        }}
      >
        <h2
          style={{
            color: '#000000',
            fontSize: layout.giantSize,
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 0.84,
            margin: 0,
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
        >
          REBUILD THE CONTEXT.
        </h2>
        <p
          style={{
            color: '#ff3000',
            fontFamily: 'var(--font-mono)',
            fontSize: layout.monoSize * 1.45,
            fontWeight: 900,
            letterSpacing: '0.18em',
            margin: `${layout.edge * 0.36}px 0 0`,
            opacity: ease(frame, 230, 262, [0, 1]),
            textAlign: 'right',
            textTransform: 'uppercase',
            transform: `translateY(${(1 - ease(frame, 230, 262, [0, 1])) * 18}px)`,
          }}
        >
          again
        </p>
      </div>
    </AbsoluteFill>
  )
}

function BuilderLoad({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: WhyFilmLayout
}) {
  const scene = sceneOpacity(frame, 270, 420, 12)
  const words = [
    { delay: 282, text: 'BUILD.', x: 0.1, y: 0.2 },
    { delay: 312, text: 'SHIP.', x: 0.5, y: 0.36 },
    { delay: 342, text: 'FOLLOW UP.', x: 0.08, y: 0.56 },
    { delay: 372, text: 'REMEMBER.', x: 0.24, y: 0.72 },
  ] as const
  const isWide = aspect === '16x9'

  return (
    <AbsoluteFill
      style={{
        background: '#000000',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#ff3000',
          bottom: layout.edge,
          height: Math.max(8, layout.monoSize * 0.5),
          left: layout.edge,
          opacity: ease(frame, 282, 312, [0, 1]),
          position: 'absolute',
          transform: `scaleX(${ease(frame, 282, 328, [0, 1])})`,
          transformOrigin: 'left',
          width: layout.edge * 2.2,
        }}
      />
      {words.map((word, index) => {
        const enter = appear(frame, word.delay, 14)
        const leave = ease(frame, word.delay + 44, word.delay + 72, [0, 1])
        const emphasis = index === 3
        const left = `${word.x * 100}%`
        const top = `${word.y * 100}%`

        return (
          <div
            key={word.text}
            style={{
              color: emphasis ? '#ff3000' : '#ffffff',
              fontSize: emphasis
                ? layout.giantSize * (isWide ? 1.08 : 0.92)
                : layout.giantSize * (isWide ? 0.92 : 0.78),
              fontWeight: 950,
              left,
              letterSpacing: 0,
              lineHeight: 0.82,
              opacity: enter * (emphasis ? 1 : 1 - leave * 0.72),
              position: 'absolute',
              textTransform: 'uppercase',
              top,
              transform: `translate3d(${(1 - enter) * -84 + leave * 36}px, 0, 0) scale(${0.9 + enter * 0.1 + (emphasis ? ease(frame, 388, 414, [0, 1]) * 0.045 : 0)})`,
              transformOrigin: 'left center',
              whiteSpace: 'nowrap',
            }}
          >
            {word.text}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

function ThesisBeat({
  frame,
  layout,
}: {
  frame: number
  layout: WhyFilmLayout
}) {
  const scene = sceneOpacity(frame, 390, 528, 16)
  const enter = appear(frame, 404, 28)
  const hold = ease(frame, 430, 510, [0, 1])
  const sub = appear(frame, 452, 24)

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        opacity: scene,
      }}
    >
      <div
        style={{
          maxWidth: '86%',
          transform: `translateY(${(1 - enter) * 34}px) scale(${0.96 + enter * 0.04 + hold * 0.025})`,
          transformOrigin: 'center',
        }}
      >
        <h2
          style={{
            color: '#000000',
            fontSize: layout.thesisSize,
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 0.84,
            margin: 0,
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ display: 'block' }}>
            WORK SHOULD <span style={{ color: '#ff3000' }}>NOT</span>
          </span>
          <span style={{ display: 'block' }}>RESET</span>
        </h2>
        <p
          style={{
            color: '#000000',
            fontFamily: 'var(--font-mono)',
            fontSize: layout.monoSize * 1.35,
            fontWeight: 900,
            letterSpacing: '0.04em',
            margin: `${layout.edge * 0.42}px 0 0`,
            opacity: sub,
            textAlign: 'center',
            transform: `translateY(${(1 - sub) * 18}px)`,
          }}
        >
          every time I sit back down
        </p>
      </div>
    </AbsoluteFill>
  )
}

function SystemShape({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: WhyFilmLayout
}) {
  const scene = sceneOpacity(frame, 510, 720, 18)
  const assemble = ease(frame, 520, 604, [0, 1])
  const compact = ease(frame, 596, 634, [0, 1])
  const resume = ease(frame, 616, 638, [0, 1])
  const isWide = aspect === '16x9'
  const modules = [
    { color: '#ffffff', delay: 524, text: 'AGENT', x: isWide ? 18 : 10, y: 18 },
    {
      color: '#ff3000',
      delay: 548,
      text: 'SCHEDULE',
      x: isWide ? 48 : 26,
      y: isWide ? 38 : 40,
    },
    {
      color: '#ffffff',
      delay: 572,
      text: 'MEMORY',
      x: isWide ? 30 : 14,
      y: isWide ? 62 : 64,
    },
  ] as const

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: scene,
      }}
    >
      <div
        style={{
          background: '#000000',
          bottom: layout.edge,
          left: layout.edge,
          overflow: 'hidden',
          position: 'absolute',
          right: layout.edge,
          top: layout.edge,
          transform: `scale(${0.94 + assemble * 0.06 - compact * 0.08})`,
          transformOrigin: 'center',
        }}
      >
        {modules.map((module, index) => {
          const enter = appear(frame, module.delay, 20)
          const x = module.x + compact * (34 - module.x)
          const y = module.y + compact * (35 + index * 12 - module.y)

          return (
            <div
              key={module.text}
              style={{
                background: module.color,
                border: '3px solid #ffffff',
                color: '#000000',
                fontSize: layout.monoSize * (isWide ? 2.45 : 2.12),
                fontWeight: 950,
                left: `${x}%`,
                lineHeight: 1,
                opacity: enter * (1 - resume),
                padding: `${layout.edge * 0.3}px ${layout.edge * 0.4}px`,
                position: 'absolute',
                textTransform: 'uppercase',
                top: `${y}%`,
                transform: `translate3d(${(1 - enter) * (index === 1 ? 120 : -120)}px, 0, 0) scale(${0.94 + enter * 0.06})`,
                transformOrigin: 'center',
              }}
            >
              {module.text}
            </div>
          )
        })}
        <div
          style={{
            color: '#ffffff',
            fontSize: layout.thesisSize * 0.72,
            fontWeight: 950,
            left: '50%',
            letterSpacing: 0,
            lineHeight: 0.86,
            opacity: resume,
            position: 'absolute',
            textAlign: 'center',
            textTransform: 'uppercase',
            top: '50%',
            transform: `translate(-50%, -50%) scale(${0.88 + resume * 0.12})`,
            whiteSpace: 'nowrap',
          }}
        >
          WORK RESUMES
        </div>
      </div>
    </AbsoluteFill>
  )
}

function WhyEndCard({
  aspect,
  frame,
  layout,
}: {
  aspect: LaunchVideoAspect
  frame: number
  layout: WhyFilmLayout
}) {
  return (
    <FilmEndCard
      aspect={aspect}
      endFrame={780}
      enterFrame={714}
      frame={frame}
      layout={layout}
      startFrame={696}
    />
  )
}

function FilmEndCard({
  aspect,
  endFrame,
  enterFrame,
  frame,
  layout,
  startFrame,
}: {
  aspect: LaunchVideoAspect
  endFrame: number
  enterFrame: number
  frame: number
  layout: WhyFilmLayout
  startFrame: number
}) {
  const scene = sceneOpacity(frame, startFrame, endFrame, 18)
  const enter = appear(frame, enterFrame, 26)
  const isWide = aspect === '16x9'

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        opacity: scene,
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'grid',
          gap: isWide ? 42 : 30,
          gridTemplateColumns: isWide ? 'auto auto' : '1fr',
          justifyItems: 'center',
          transform: `translateY(${(1 - enter) * 28}px) scale(${0.97 + enter * 0.03})`,
        }}
      >
        <Img
          alt="OUTNA.ME logo"
          src={staticFile('email/outna-logo.png')}
          style={{
            height: layout.finalLogoSize,
            width: layout.finalLogoSize,
          }}
        />
        <div
          style={{
            display: 'grid',
            gap: layout.edge * 0.22,
            justifyItems: isWide ? 'start' : 'center',
            textAlign: isWide ? 'left' : 'center',
          }}
        >
          <strong
            style={{
              color: '#000000',
              fontSize: layout.finalWordmarkSize,
              fontWeight: 950,
              letterSpacing: 0,
              lineHeight: 0.82,
              textTransform: 'uppercase',
            }}
          >
            OUTNA.ME
          </strong>
          <span
            style={{
              color: '#ff3000',
              fontFamily: 'var(--font-mono)',
              fontSize: layout.finalCaptionSize,
              fontWeight: 900,
              letterSpacing: '0.18em',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            personal agent runtime
          </span>
          <span
            style={{
              color: '#000000',
              fontFamily: 'var(--font-mono)',
              fontSize: layout.finalCaptionSize * 0.92,
              fontWeight: 850,
              letterSpacing: '0.12em',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            waitlist open
          </span>
        </div>
      </div>
    </AbsoluteFill>
  )
}

function aspectLineWidth(layout: WhyFilmLayout) {
  return layout.edge * 2.3
}

function sceneOpacity(
  frame: number,
  start: number,
  end: number,
  fadeFrames: number
) {
  const enter = ease(frame, start, start + fadeFrames, [0, 1])
  const exit = ease(frame, end - fadeFrames, end, [1, 0])

  return Math.min(enter, exit)
}

function ease(
  frame: number,
  start: number,
  end: number,
  output: readonly [number, number]
) {
  return interpolate(frame, [start, end], output, {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

function renderStory(
  slug: LaunchVideoSlug,
  aspect: LaunchVideoAspect,
  frame: number,
  layout: VideoLayout
) {
  if (slug === '2026-05-18-why-outname-exists') {
    return <WhyOutnameExists aspect={aspect} frame={frame} layout={layout} />
  }

  if (slug === '2026-05-20-agent-configuration') {
    return <AgentConfiguration aspect={aspect} frame={frame} layout={layout} />
  }

  if (slug === '2026-05-22-autonomous-run') {
    return <AutonomousRun aspect={aspect} frame={frame} layout={layout} />
  }

  if (slug === '2026-05-26-memory-over-time') {
    return <MemoryOverTime aspect={aspect} frame={frame} layout={layout} />
  }

  if (slug === '2026-05-28-composable-channels') {
    return <ComposableChannels aspect={aspect} frame={frame} layout={layout} />
  }

  return <VercelStack aspect={aspect} frame={frame} layout={layout} />
}

function VideoShell({
  aspect,
  children,
  frame,
  layout,
  meta,
}: {
  aspect: LaunchVideoAspect
  children: ReactNode
  frame: number
  layout: VideoLayout
  meta: VideoMeta
}) {
  const headerProgress = appear(frame, 4, 24)
  const ctaProgress = appear(frame, CTA_START_FRAME, 26)

  return (
    <div
      style={{
        display: 'grid',
        gap: layout.bodyGap,
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        height: '100%',
      }}
    >
      <header
        style={{
          borderTop: '5px solid #000000',
          display: 'grid',
          gap: aspect === '16x9' ? 20 : 14,
          opacity: headerProgress,
          paddingTop: 18,
          transform: `translateY(${(1 - headerProgress) * 22}px)`,
        }}
      >
        <VideoLabel style={{ fontSize: layout.eyebrowSize }}>
          {meta.eyebrow}
        </VideoLabel>
        <div
          style={{
            alignItems: aspect === '16x9' ? 'end' : 'start',
            display: 'grid',
            gap: aspect === '16x9' ? 32 : 16,
            gridTemplateColumns: aspect === '16x9' ? '1.15fr 0.85fr' : '1fr',
          }}
        >
          <h1
            style={{
              fontSize: layout.headlineSize,
              fontWeight: 950,
              letterSpacing: 0,
              lineHeight: 0.9,
              margin: 0,
              maxWidth: aspect === '16x9' ? 1180 : 920,
              textTransform: 'uppercase',
            }}
          >
            {meta.headline}
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: layout.sublineSize,
              fontWeight: 800,
              lineHeight: 1.22,
              margin: 0,
              textAlign: aspect === '16x9' ? 'right' : 'left',
              textTransform: 'uppercase',
            }}
          >
            {meta.subline}
          </p>
        </div>
      </header>

      <main
        style={{
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {children}
      </main>

      <footer
        style={{
          alignItems: 'center',
          borderTop: '3px solid #000000',
          display: 'grid',
          gap: 16,
          gridTemplateColumns: aspect === '16x9' ? '1fr auto' : '1fr',
          opacity: Math.max(0.84, ctaProgress),
          paddingTop: 16,
          transform: `translateY(${(1 - ctaProgress) * 18}px)`,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: layout.footerNoteSize,
            fontWeight: 800,
            lineHeight: 1.2,
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          Public pre-launch lab.
        </p>
        <p
          style={{
            fontSize: layout.ctaSize,
            fontWeight: 950,
            lineHeight: 0.9,
            margin: 0,
            textAlign: aspect === '16x9' ? 'right' : 'left',
            textTransform: 'uppercase',
          }}
        >
          {meta.cta}
        </p>
      </footer>
    </div>
  )
}

function BrandClosingOverlay({
  aspect,
  frame,
}: {
  aspect: LaunchVideoAspect
  frame: number
}) {
  const progress = appear(frame, BRAND_CLOSE_FRAME, 24)
  const layout = getBrandCloseLayout(aspect)

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        opacity: progress,
        pointerEvents: 'none',
        transform: `translateY(${(1 - progress) * 28}px)`,
        zIndex: 20,
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'grid',
          gap: layout.gap,
          gridTemplateColumns: layout.columns,
          justifyItems: 'center',
        }}
      >
        <Img
          alt="OUTNA.ME logo"
          src={staticFile('email/outna-logo.png')}
          style={{
            height: layout.logoSize,
            width: layout.logoSize,
          }}
        />
        <div
          style={{
            display: 'grid',
            gap: layout.wordmarkGap,
            justifyItems: layout.wordmarkAlign,
            textAlign: layout.textAlign,
          }}
        >
          <strong
            style={{
              color: '#000000',
              fontSize: layout.wordmarkSize,
              fontWeight: 950,
              letterSpacing: 0,
              lineHeight: 0.82,
              textTransform: 'uppercase',
            }}
          >
            OUTNA.ME
          </strong>
          <span
            style={{
              color: '#ff3000',
              fontFamily: 'var(--font-mono)',
              fontSize: layout.captionSize,
              fontWeight: 900,
              letterSpacing: '0.18em',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            personal agent runtime
          </span>
        </div>
      </div>
    </AbsoluteFill>
  )
}

function WhyOutnameExists({ aspect, frame, layout }: StoryProps) {
  return (
    <SceneStack>
      <Scene frame={frame} from={BODY_START_FRAME} to={176}>
        <VideoPanel
          style={{
            display: 'grid',
            gap: 24,
            gridTemplateColumns: aspect === '16x9' ? '0.92fr 1.08fr' : '1fr',
            height: '100%',
            padding: layout.scenePadding,
          }}
        >
          <SectionTitle kicker="the friction" title="Context resets." />
          <StackedWindows
            frame={frame}
            items={[
              ['Project notes', 'Where were we?'],
              ['Client thread', 'What changed?'],
              ['Build queue', "What's next?"],
            ]}
          />
        </VideoPanel>
      </Scene>

      <Scene frame={frame} from={156} to={306}>
        <div
          style={{
            display: 'grid',
            gap: 18,
            gridTemplateColumns: aspect === '16x9' ? '1fr 1fr 1fr' : '1fr',
            height: '100%',
          }}
        >
          {['Research', 'Follow-up', 'Draft'].map((label, index) => (
            <ManualLoopCard
              compact={aspect !== '16x9'}
              frame={frame}
              index={index}
              key={label}
              label={label}
            />
          ))}
        </div>
      </Scene>

      <Scene frame={frame} from={286} to={486}>
        <VideoPanel
          emphasis
          style={{
            display: 'grid',
            gap: 26,
            gridTemplateColumns: aspect === '16x9' ? '0.9fr 1.1fr' : '1fr',
            height: '100%',
            padding: layout.scenePadding,
          }}
        >
          <SectionTitle dark kicker="the system" title="Agents come back." />
          <ReturnBoard frame={frame} />
        </VideoPanel>
      </Scene>
    </SceneStack>
  )
}

function AgentConfiguration({ aspect, frame, layout }: StoryProps) {
  return (
    <SceneStack>
      <Scene frame={frame} from={BODY_START_FRAME} to={178}>
        <div
          style={{
            display: 'grid',
            gap: 18,
            gridTemplateColumns: aspect === '16x9' ? '0.8fr 1.2fr' : '1fr',
            height: '100%',
          }}
        >
          <AgentList frame={frame} />
          <VideoPanel
            style={{
              display: 'grid',
              gap: 18,
              padding: layout.scenePadding,
            }}
          >
            <SectionTitle
              kicker="choose the operator"
              title="One job. One operator."
            />
            <ProfileStrip
              activeIndex={Math.min(2, Math.floor((frame - 90) / 28))}
              items={['Research', 'Writing', 'Ops']}
            />
          </VideoPanel>
        </div>
      </Scene>

      <Scene frame={frame} from={158} to={334}>
        <ConfigWorkbench aspect={aspect} frame={frame} layout={layout} />
      </Scene>

      <Scene frame={frame} from={314} to={486}>
        <VideoPanel
          emphasis
          style={{
            display: 'grid',
            gap: 22,
            height: '100%',
            padding: layout.scenePadding,
          }}
        >
          <SectionTitle
            dark
            kicker="configured"
            title="Model. Identity. Schedule."
          />
          <ConfiguredAgentCard frame={frame} />
        </VideoPanel>
      </Scene>
    </SceneStack>
  )
}

function AutonomousRun({ aspect, frame, layout }: StoryProps) {
  return (
    <SceneStack>
      <Scene frame={frame} from={BODY_START_FRAME} to={178}>
        <ScheduleTrigger aspect={aspect} frame={frame} layout={layout} />
      </Scene>

      <Scene frame={frame} from={158} to={328}>
        <RunPipeline aspect={aspect} frame={frame} layout={layout} />
      </Scene>

      <Scene frame={frame} from={308} to={486}>
        <MemoryUpdateScene aspect={aspect} frame={frame} layout={layout} />
      </Scene>
    </SceneStack>
  )
}

function MemoryOverTime({ aspect, frame, layout }: StoryProps) {
  return (
    <SceneStack>
      <Scene frame={frame} from={BODY_START_FRAME} to={214}>
        <RunHistoryGrid aspect={aspect} frame={frame} layout={layout} />
      </Scene>

      <Scene frame={frame} from={194} to={346}>
        <MemoryCanvas aspect={aspect} frame={frame} layout={layout} />
      </Scene>

      <Scene frame={frame} from={326} to={486}>
        <LessSetupScene aspect={aspect} frame={frame} layout={layout} />
      </Scene>
    </SceneStack>
  )
}

function ComposableChannels({ aspect, frame, layout }: StoryProps) {
  return (
    <SceneStack>
      <Scene frame={frame} from={BODY_START_FRAME} to={202}>
        <ComposableHub aspect={aspect} frame={frame} layout={layout} />
      </Scene>

      <Scene frame={frame} from={182} to={338}>
        <ChannelRouter aspect={aspect} frame={frame} layout={layout} />
      </Scene>

      <Scene frame={frame} from={318} to={486}>
        <ComingSoonSlots aspect={aspect} frame={frame} layout={layout} />
      </Scene>
    </SceneStack>
  )
}

function VercelStack({ aspect, frame, layout }: StoryProps) {
  return (
    <SceneStack>
      <Scene frame={frame} from={BODY_START_FRAME} to={206}>
        <VercelLayerBuild aspect={aspect} frame={frame} layout={layout} />
      </Scene>

      <Scene frame={frame} from={186} to={346}>
        <PrimitiveFlow aspect={aspect} frame={frame} layout={layout} />
      </Scene>

      <Scene frame={frame} from={326} to={486}>
        <DeployPath aspect={aspect} frame={frame} layout={layout} />
      </Scene>
    </SceneStack>
  )
}

function StackedWindows({
  frame,
  items,
}: {
  frame: number
  items: readonly (readonly [string, string])[]
}) {
  const deckMove = progressBetween(frame, 100, 170)

  return (
    <div
      style={{
        minHeight: 0,
        position: 'relative',
        transform: `translate3d(${deckMove * -18}px, ${deckMove * -14}px, 0) scale(${1 + deckMove * 0.035})`,
        transformOrigin: 'center',
      }}
    >
      {items.map(([title, detail], index) => {
        const progress = appear(frame, 90 + index * 18, 18)
        const focus = progressBetween(frame, 110 + index * 18, 156 + index * 18)
        return (
          <div
            key={title}
            style={{
              background: '#ffffff',
              border: '3px solid #000000',
              boxShadow: '10px 10px 0 #000000',
              left: index * 28,
              opacity: progress,
              padding: 22,
              position: 'absolute',
              right: 72 - index * 22,
              top: index * 58,
              transform: `translate3d(${(1 - progress) * 34 - focus * 10}px, ${(1 - progress) * 10 - focus * 8}px, 0) scale(${1 + focus * 0.025})`,
              transformOrigin: 'center',
            }}
          >
            <VideoTag>{title}</VideoTag>
            <p
              style={{
                fontSize: 40,
                fontWeight: 950,
                lineHeight: 0.95,
                margin: '20px 0 0',
                textTransform: 'uppercase',
              }}
            >
              {detail}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function ManualLoopCard({
  compact,
  frame,
  index,
  label,
}: {
  compact: boolean
  frame: number
  index: number
  label: string
}) {
  const progress = appear(frame, 178 + index * 24, 18)
  const barProgress = progressBetween(frame, 210 + index * 18, 292)
  const focus = progressBetween(frame, 202 + index * 20, 250 + index * 20)
  const exit = progressBetween(frame, 278, 306)

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: compact ? 10 : 22,
        gridTemplateRows: 'auto 1fr auto',
        minHeight: 0,
        opacity: progress,
        padding: compact ? 14 : 24,
        transform: `translate3d(0, ${(1 - progress) * 28 - focus * 10 + exit * 12}px, 0) scale(${0.97 + progress * 0.03 + focus * 0.035 - exit * 0.025})`,
        transformOrigin: 'center',
      }}
    >
      <VideoTag>{label}</VideoTag>
      <div
        style={{
          alignContent: 'center',
          display: 'grid',
          gap: compact ? 7 : 14,
          minHeight: 0,
        }}
      >
        {['Open', 'Rebuild', 'Move'].map((step, stepIndex) => (
          <div
            key={step}
            style={{
              background: stepIndex === 1 ? '#ff3000' : '#f4f4f4',
              border: '2px solid #000000',
              fontFamily: 'var(--font-mono)',
              fontSize: compact ? 12 : 16,
              fontWeight: 850,
              opacity: appear(frame, 190 + index * 20 + stepIndex * 9, 12),
              padding: compact ? '8px 10px' : '14px 16px',
              transform: `translateX(${
                (1 - appear(frame, 190 + index * 20 + stepIndex * 9, 12)) * -18
              }px)`,
              textTransform: 'uppercase',
            }}
          >
            {step}
          </div>
        ))}
      </div>
      <div
        style={{
          background: '#f0f0f0',
          border: '2px solid #000000',
          height: compact ? 10 : 18,
        }}
      >
        <div
          style={{
            background: '#000000',
            height: '100%',
            width: `${Math.round(barProgress * 100)}%`,
          }}
        />
      </div>
    </VideoPanel>
  )
}

function ReturnBoard({ frame }: { frame: number }) {
  const boardFocus = progressBetween(frame, 324, 440)

  return (
    <div
      style={{
        alignContent: 'center',
        display: 'grid',
        gap: 16,
        minHeight: 0,
        transform: `translateY(${boardFocus * -18}px) scale(${1 + boardFocus * 0.025})`,
        transformOrigin: 'center',
      }}
    >
      {[
        ['08:30', 'Research resumes'],
        ['12:00', 'Queue checked'],
        ['17:30', 'Draft ready'],
      ].map(([time, label], index) => {
        const progress = appear(frame, 326 + index * 22, 18)
        const focus = progressBetween(frame, 338 + index * 24, 386 + index * 24)
        return (
          <div
            key={time}
            style={{
              alignItems: 'center',
              background: index === 1 ? '#ff3000' : '#ffffff',
              border: '3px solid #ffffff',
              color: '#000000',
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'auto 1fr',
              opacity: progress,
              padding: '20px 22px',
              transform: `translate3d(${(1 - progress) * 48 - focus * 18}px, 0, 0) scale(${1 + focus * 0.035})`,
              transformOrigin: 'center',
            }}
          >
            <strong
              style={{
                color: index === 1 ? '#000000' : '#ff3000',
                fontFamily: 'var(--font-mono)',
                fontSize: 28,
                fontWeight: 950,
              }}
            >
              {time}
            </strong>
            <span
              style={{
                fontSize: 34,
                fontWeight: 950,
                lineHeight: 1,
                textTransform: 'uppercase',
              }}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function AgentList({ frame }: { frame: number }) {
  const listCompress = progressBetween(frame, 126, 176)

  return (
    <VideoPanel
      emphasis
      style={{
        display: 'grid',
        gap: 14,
        padding: 26,
        transform: `scale(${1 - listCompress * 0.045}) translateY(${listCompress * -10}px)`,
        transformOrigin: 'center',
      }}
    >
      <VideoLabel invert>agents</VideoLabel>
      {['Research', 'Writing', 'Ops'].map((agent, index) => {
        const progress = appear(frame, 88 + index * 20, 18)
        const focus = progressBetween(frame, 104 + index * 18, 148 + index * 18)
        const isActive = index === 1
        return (
          <div
            key={agent}
            style={{
              background: isActive ? '#ff3000' : '#111111',
              border: '2px solid rgba(255,255,255,0.38)',
              color: isActive ? '#000000' : '#ffffff',
              opacity: progress,
              padding: '18px 20px',
              transform: `translate3d(${(1 - progress) * -28 + focus * 14}px, 0, 0) scale(${1 + focus * 0.035})`,
              transformOrigin: 'center',
            }}
          >
            <strong
              style={{
                display: 'block',
                fontSize: 29,
                fontWeight: 950,
                lineHeight: 1,
                textTransform: 'uppercase',
              }}
            >
              {agent}
            </strong>
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                fontWeight: 750,
                marginTop: 10,
                textTransform: 'uppercase',
              }}
            >
              operator
            </span>
          </div>
        )
      })}
    </VideoPanel>
  )
}

function ProfileStrip({
  activeIndex,
  items,
}: {
  activeIndex: number
  items: readonly string[]
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 12,
        gridTemplateColumns: 'repeat(3, 1fr)',
      }}
    >
      {items.map((item, index) => (
        <div
          key={item}
          style={{
            background: index === activeIndex ? '#ff3000' : '#f4f4f4',
            border: '2px solid #000000',
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            fontWeight: 900,
            padding: '16px 12px',
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
        >
          {item}
        </div>
      ))}
    </div>
  )
}

function ConfigWorkbench({ aspect, frame, layout }: StoryProps) {
  const fields = [
    ['model', 'Sonnet'],
    ['identity', 'Writer'],
    ['schedule', '09:00'],
    ['memory', 'Context'],
  ] as const
  const panelMove = progressBetween(frame, 182, 314)

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 20,
        gridTemplateColumns: aspect === '16x9' ? '0.8fr 1.2fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
        transform: `scale(${0.985 + panelMove * 0.015})`,
        transformOrigin: 'left center',
      }}
    >
      <SectionTitle kicker="workbench" title="Configuration first." />
      <div style={{ display: 'grid', gap: 14 }}>
        {fields.map(([label, value], index) => {
          const progress = appear(frame, 188 + index * 22, 16)
          const focus = progressBetween(
            frame,
            198 + index * 22,
            238 + index * 22
          )
          return (
            <div
              key={label}
              style={{
                alignItems: 'center',
                background: index === 2 ? '#ff3000' : '#ffffff',
                border: '3px solid #000000',
                display: 'grid',
                gap: 14,
                gridTemplateColumns: '0.45fr 1fr',
                opacity: progress,
                padding: '16px 18px',
                transform: `translate3d(${(1 - progress) * 32 - focus * 18}px, 0, 0) scale(${1 + focus * 0.035})`,
                transformOrigin: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 15,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                }}
              >
                {label}
              </span>
              <strong
                style={{
                  fontSize: 27,
                  fontWeight: 950,
                  lineHeight: 1,
                  textTransform: 'uppercase',
                }}
              >
                {value}
              </strong>
            </div>
          )
        })}
      </div>
    </VideoPanel>
  )
}

function ConfiguredAgentCard({ frame }: { frame: number }) {
  const pulse = progressBetween(frame, 348, 430)
  const cardIn = appear(frame, 334, 26)

  return (
    <div
      style={{
        alignItems: 'center',
        border: '3px solid #ffffff',
        display: 'grid',
        gap: 22,
        gridTemplateColumns: '1fr auto',
        opacity: cardIn,
        padding: 28,
        transform: `scale(${0.92 + cardIn * 0.08 + pulse * 0.035})`,
        transformOrigin: 'center',
      }}
    >
      <div
        style={{
          transform: `translateX(${(1 - cardIn) * -36}px)`,
        }}
      >
        <VideoTag active>active</VideoTag>
        <p
          style={{
            color: '#ffffff',
            fontSize: 58,
            fontWeight: 950,
            lineHeight: 0.9,
            margin: '22px 0 0',
            textTransform: 'uppercase',
          }}
        >
          Writing
        </p>
      </div>
      <div
        style={{
          background: '#ff3000',
          border: '3px solid #ffffff',
          color: '#000000',
          fontFamily: 'var(--font-mono)',
          fontSize: 36,
          fontWeight: 950,
          padding: 28,
          transform: `translateX(${(1 - cardIn) * 44}px) scale(${0.92 + pulse * 0.08})`,
        }}
      >
        09:00
      </div>
    </div>
  )
}

function ScheduleTrigger({ aspect, frame, layout }: StoryProps) {
  const pulse = progressBetween(frame, 92, 168)
  const settle = progressBetween(frame, 144, 178)

  return (
    <VideoPanel
      style={{
        alignItems: 'center',
        display: 'grid',
        gap: 28,
        gridTemplateColumns: aspect === '16x9' ? '0.82fr 1.18fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
        transform: `scale(${0.985 + pulse * 0.025 - settle * 0.01})`,
        transformOrigin: 'left center',
      }}
    >
      <SectionTitle kicker="schedule" title="08:30. It starts." />
      <div
        style={{
          background: '#000000',
          color: '#ffffff',
          display: 'grid',
          gap: 22,
          padding: 34,
          transform: `translateX(${settle * (aspect === '16x9' ? 22 : 0)}px) scale(${1 + pulse * 0.055})`,
          transformOrigin: 'center',
        }}
      >
        <span
          style={{
            color: '#ff3000',
            fontFamily: 'var(--font-mono)',
            fontSize: 28,
            fontWeight: 950,
          }}
        >
          WEEKDAY CRON
        </span>
        <strong
          style={{
            fontSize: aspect === '16x9' ? 116 : 96,
            fontWeight: 950,
            lineHeight: 0.82,
          }}
        >
          08:30
        </strong>
        <div
          style={{
            background: '#ff3000',
            height: 16,
            transform: `scaleX(${pulse})`,
            transformOrigin: 'left',
          }}
        />
      </div>
    </VideoPanel>
  )
}

function RunPipeline({ aspect, frame, layout }: StoryProps) {
  const nodes = ['Channel', 'Tool', 'Sub-agent', 'Memory'] as const
  const travel = progressBetween(frame, 194, 292)

  return (
    <VideoPanel
      emphasis
      style={{
        display: 'grid',
        gap: 22,
        height: '100%',
        padding: layout.scenePadding,
        transform: `translateY(${travel * -10}px) scale(${0.985 + travel * 0.015})`,
        transformOrigin: 'left center',
      }}
    >
      <SectionTitle dark kicker="run in motion" title="Input becomes action." />
      <div
        style={{
          alignItems: 'stretch',
          display: 'grid',
          gap: 14,
          gridTemplateColumns: aspect === '16x9' ? 'repeat(4, 1fr)' : '1fr',
        }}
      >
        {nodes.map((node, index) => {
          const progress = appear(frame, 194 + index * 28, 18)
          const active = progressBetween(
            frame,
            198 + index * 24,
            242 + index * 24
          )
          return (
            <PipelineNode
              active={active}
              index={index}
              key={node}
              label={node}
              progress={progress}
            />
          )
        })}
      </div>
    </VideoPanel>
  )
}

function PipelineNode({
  active,
  index,
  label,
  progress,
}: {
  active: number
  index: number
  label: string
  progress: number
}) {
  return (
    <div
      style={{
        background: index === 2 ? '#ff3000' : '#ffffff',
        border: '3px solid #ffffff',
        color: '#000000',
        display: 'grid',
        gap: 14,
        minHeight: 132,
        opacity: progress,
        padding: 18,
        transform: `translateY(${(1 - progress) * 28 - active * 16}px) scale(${1 + active * 0.055})`,
        transformOrigin: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 15,
          fontWeight: 950,
        }}
      >
        0{index + 1}
      </span>
      <strong
        style={{
          fontSize: 32,
          fontWeight: 950,
          lineHeight: 0.95,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </strong>
    </div>
  )
}

function MemoryUpdateScene({ aspect, frame, layout }: StoryProps) {
  const sceneFocus = progressBetween(frame, 334, 470)

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 22,
        gridTemplateColumns: aspect === '16x9' ? '0.8fr 1.2fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
        transform: `scale(${0.985 + sceneFocus * 0.015})`,
        transformOrigin: 'left center',
      }}
    >
      <SectionTitle kicker="next run" title="Next run knows more." />
      <MemoryChips
        frame={frame}
        items={['short recap', 'check channel', 'draft first']}
        start={340}
      />
    </VideoPanel>
  )
}

function RunHistoryGrid({ aspect, frame, layout }: StoryProps) {
  const historyMove = progressBetween(frame, 106, 198)

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 18,
        height: '100%',
        padding: layout.scenePadding,
        transform: `scale(${0.985 + historyMove * 0.015}) translateY(${historyMove * -10}px)`,
        transformOrigin: 'left center',
      }}
    >
      <SectionTitle kicker="repeated work" title="Less setup." />
      <div
        style={{
          display: 'grid',
          gap: 14,
          gridTemplateColumns: aspect === '16x9' ? 'repeat(3, 1fr)' : '1fr',
          minHeight: 0,
        }}
      >
        {[
          ['Run 01', 'Context'],
          ['Run 02', 'Preference'],
          ['Run 03', 'Closer start'],
        ].map(([run, result], index) => {
          const progress = appear(frame, 104 + index * 30, 18)
          const focus = progressBetween(
            frame,
            120 + index * 26,
            174 + index * 26
          )
          return (
            <div
              key={run}
              style={{
                background: index === 2 ? '#ff3000' : '#ffffff',
                border: '3px solid #000000',
                opacity: progress,
                padding: 22,
                transform: `translateY(${(1 - progress) * 26 - focus * 16}px) scale(${1 + focus * 0.045})`,
                transformOrigin: 'center',
              }}
            >
              <VideoTag>{run}</VideoTag>
              <p
                style={{
                  fontSize: 40,
                  fontWeight: 950,
                  lineHeight: 0.95,
                  margin: '22px 0 0',
                  textTransform: 'uppercase',
                }}
              >
                {result}
              </p>
            </div>
          )
        })}
      </div>
    </VideoPanel>
  )
}

function MemoryCanvas({ aspect, frame, layout }: StoryProps) {
  const memoryZoom = progressBetween(frame, 222, 326)

  return (
    <VideoPanel
      emphasis
      style={{
        display: 'grid',
        gap: 24,
        gridTemplateColumns: aspect === '16x9' ? '0.85fr 1.15fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
        transform: `scale(${0.985 + memoryZoom * 0.015}) translateY(${memoryZoom * -10}px)`,
        transformOrigin: 'left center',
      }}
    >
      <SectionTitle dark kicker="memory" title="Memory compounds." />
      <MemoryChips
        dark
        frame={frame}
        items={['tone', 'format', 'client', 'sources']}
        start={224}
      />
    </VideoPanel>
  )
}

function LessSetupScene({ aspect, frame, layout }: StoryProps) {
  const outcomeZoom = progressBetween(frame, 344, 464)

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 20,
        gridTemplateColumns: aspect === '16x9' ? '1fr 1fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
        transform: `scale(${0.985 + outcomeZoom * 0.015})`,
        transformOrigin: 'left center',
      }}
    >
      <SectionTitle kicker="outcome" title="Less explaining." />
      <div style={{ display: 'grid', gap: 14 }}>
        {['Context dump', 'Tone reminder', 'Start from memory'].map(
          (line, index) => {
            const progress = appear(frame, 344 + index * 18, 16)
            const removed = index < 2
            const removeMove = removed
              ? progressBetween(frame, 366 + index * 14, 438)
              : 0
            return (
              <div
                key={line}
                style={{
                  background: removed ? '#f4f4f4' : '#ff3000',
                  border: '3px solid #000000',
                  color: removed ? '#8a8a8a' : '#000000',
                  opacity: removed ? 1 - progress * 0.62 : progress,
                  padding: '18px 20px',
                  transform: removed
                    ? `translateX(${removeMove * -26}px) scale(${1 - removeMove * 0.06})`
                    : `translateY(${(1 - progress) * 28}px) scale(${0.96 + progress * 0.04})`,
                  transformOrigin: 'center',
                }}
              >
                <strong
                  style={{
                    fontSize: 28,
                    fontWeight: 950,
                    lineHeight: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  {line}
                </strong>
              </div>
            )
          }
        )}
      </div>
    </VideoPanel>
  )
}

function ComposableHub({ aspect, frame, layout }: StoryProps) {
  const items = ['Tools', 'Sub-agents', 'Channels', 'Memory']
  const assemble = progressBetween(frame, 104, 186)

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 24,
        gridTemplateColumns: aspect === '16x9' ? '0.85fr 1.15fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
        transform: `scale(${0.985 + assemble * 0.015}) translateY(${assemble * -10}px)`,
        transformOrigin: 'left center',
      }}
    >
      <SectionTitle kicker="composition" title="Pieces snap together." />
      <div
        style={{
          display: 'grid',
          gap: 14,
          gridTemplateColumns: '1fr 1fr',
        }}
      >
        {items.map((item, index) => {
          const progress = appear(frame, 104 + index * 20, 18)
          const focus = progressBetween(
            frame,
            118 + index * 18,
            164 + index * 18
          )
          const xDirection = index % 2 === 0 ? -1 : 1
          const yDirection = index < 2 ? -1 : 1
          return (
            <div
              key={item}
              style={{
                background: index === 1 ? '#ff3000' : '#ffffff',
                border: '3px solid #000000',
                opacity: progress,
                padding: 22,
                transform: `translate3d(${(1 - progress) * xDirection * 38}px, ${
                  (1 - progress) * yDirection * 30 - focus * 10
                }px, 0) scale(${0.94 + progress * 0.06 + focus * 0.045})`,
                transformOrigin: 'center',
              }}
            >
              <strong
                style={{
                  fontSize: 36,
                  fontWeight: 950,
                  lineHeight: 0.95,
                  textTransform: 'uppercase',
                }}
              >
                {item}
              </strong>
            </div>
          )
        })}
      </div>
    </VideoPanel>
  )
}

function ChannelRouter({ aspect, frame, layout }: StoryProps) {
  const routeMove = progressBetween(frame, 210, 320)

  return (
    <VideoPanel
      emphasis
      style={{
        display: 'grid',
        gap: 24,
        gridTemplateColumns: aspect === '16x9' ? '1fr 0.8fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
        transform: `scale(${0.985 + routeMove * 0.015})`,
        transformOrigin: 'left center',
      }}
    >
      <ChannelGrid frame={frame} />
      <SectionTitle dark kicker="channels" title="Every channel is a route." />
    </VideoPanel>
  )
}

function ChannelGrid({ frame }: { frame: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 14,
        gridTemplateColumns: '1fr 1fr',
      }}
    >
      {['Slack', 'Telegram', 'Discord', 'Webhooks'].map((channel, index) => {
        const progress = appear(frame, 214 + index * 18, 16)
        const focus = progressBetween(frame, 224 + index * 18, 268 + index * 18)
        return (
          <div
            key={channel}
            style={{
              background: index === 3 ? '#ff3000' : '#ffffff',
              border: '3px solid #ffffff',
              color: '#000000',
              opacity: progress,
              padding: 24,
              transform: `translate3d(${(1 - progress) * (index % 2 === 0 ? -34 : 34)}px, ${focus * -8}px, 0) scale(${1 + focus * 0.04})`,
              transformOrigin: 'center',
            }}
          >
            <strong
              style={{
                fontSize: 34,
                fontWeight: 950,
                lineHeight: 0.95,
                textTransform: 'uppercase',
              }}
            >
              {channel}
            </strong>
          </div>
        )
      })}
    </div>
  )
}

function ComingSoonSlots({ aspect, frame, layout }: StoryProps) {
  const queueMove = progressBetween(frame, 344, 468)

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 20,
        gridTemplateColumns: aspect === '16x9' ? '0.9fr 1.1fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
        transform: `scale(${0.985 + queueMove * 0.015}) translateY(${queueMove * -10}px)`,
        transformOrigin: 'left center',
      }}
    >
      <SectionTitle kicker="next pieces" title="MCP. Skills. Templates." />
      <div style={{ display: 'grid', gap: 14 }}>
        {['MCP', 'Skills', 'Templates'].map((slot, index) => {
          const progress = appear(frame, 350 + index * 22, 16)
          const focus = progressBetween(
            frame,
            360 + index * 20,
            410 + index * 20
          )
          return (
            <div
              key={slot}
              style={{
                background: index === 0 ? '#ff3000' : '#ffffff',
                border: '3px dashed #000000',
                opacity: progress,
                padding: '22px 24px',
                transform: `translateY(${(1 - progress) * 24 - focus * 12}px) scale(${1 + focus * 0.045})`,
                transformOrigin: 'center',
              }}
            >
              <strong
                style={{
                  fontSize: 34,
                  fontWeight: 950,
                  lineHeight: 1,
                  textTransform: 'uppercase',
                }}
              >
                {slot}
              </strong>
            </div>
          )
        })}
      </div>
    </VideoPanel>
  )
}

function VercelLayerBuild({ aspect, frame, layout }: StoryProps) {
  const layers = ['AI SDK', 'Workflow', 'Sandbox', 'Crons', 'Chat SDK'] as const
  const layerMove = progressBetween(frame, 104, 196)

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 22,
        gridTemplateColumns: aspect === '16x9' ? '0.8fr 1.2fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
        transform: `scale(${0.985 + layerMove * 0.015}) translateY(${layerMove * -10}px)`,
        transformOrigin: 'left center',
      }}
    >
      <SectionTitle kicker="platform stack" title="Primitives, not glue." />
      <div style={{ display: 'grid', gap: 10 }}>
        {layers.map((layer, index) => {
          const progress = appear(frame, 102 + index * 20, 18)
          const focus = progressBetween(
            frame,
            114 + index * 18,
            152 + index * 18
          )
          return (
            <div
              key={layer}
              style={{
                background: index === 2 ? '#ff3000' : '#000000',
                border: '3px solid #000000',
                color: index === 2 ? '#000000' : '#ffffff',
                opacity: progress,
                padding: '16px 20px',
                transform: `translate3d(${(1 - progress) * 42 - focus * 18}px, 0, 0) scale(${1 + focus * 0.04})`,
                transformOrigin: 'center',
              }}
            >
              <strong
                style={{
                  fontSize: 34,
                  fontWeight: 950,
                  lineHeight: 1,
                  textTransform: 'uppercase',
                }}
              >
                {layer}
              </strong>
            </div>
          )
        })}
      </div>
    </VideoPanel>
  )
}

function PrimitiveFlow({ aspect, frame, layout }: StoryProps) {
  const flowMove = progressBetween(frame, 218, 330)

  return (
    <VideoPanel
      emphasis
      style={{
        display: 'grid',
        gap: 20,
        height: '100%',
        padding: layout.scenePadding,
        transform: `scale(${0.985 + flowMove * 0.015})`,
        transformOrigin: 'left center',
      }}
    >
      <SectionTitle
        dark
        kicker="execution path"
        title="Generate. Run. Return."
      />
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: aspect === '16x9' ? 'repeat(5, 1fr)' : '1fr',
        }}
      >
        {['Generate', 'Workflow', 'Sandbox', 'Cron', 'UI'].map(
          (label, index) => {
            const progress = appear(frame, 218 + index * 18, 16)
            const focus = progressBetween(
              frame,
              226 + index * 18,
              266 + index * 18
            )
            return (
              <div
                key={label}
                style={{
                  background: index === 3 ? '#ff3000' : '#ffffff',
                  border: '3px solid #ffffff',
                  color: '#000000',
                  opacity: progress,
                  padding: 18,
                  transform: `translateY(${(1 - progress) * 30 - focus * 12}px) scale(${1 + focus * 0.045})`,
                  transformOrigin: 'center',
                }}
              >
                <strong
                  style={{
                    fontSize: 27,
                    fontWeight: 950,
                    lineHeight: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </strong>
              </div>
            )
          }
        )}
      </div>
    </VideoPanel>
  )
}

function DeployPath({ aspect, frame, layout }: StoryProps) {
  const deployMove = progressBetween(frame, 350, 470)

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 22,
        gridTemplateColumns: aspect === '16x9' ? '0.85fr 1.15fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
        transform: `scale(${0.985 + deployMove * 0.015})`,
        transformOrigin: 'left center',
      }}
    >
      <SectionTitle kicker="open source soon" title="Fork. Deploy. Own." />
      <div style={{ display: 'grid', gap: 14 }}>
        {['Fork', 'Env', 'Vercel'].map((step, index) => {
          const progress = appear(frame, 350 + index * 22, 16)
          const focus = progressBetween(
            frame,
            360 + index * 20,
            414 + index * 20
          )
          return (
            <div
              key={step}
              style={{
                background: index === 2 ? '#ff3000' : '#ffffff',
                border: '3px solid #000000',
                opacity: progress,
                padding: '20px 22px',
                transform: `translateX(${(1 - progress) * 36 - focus * 18}px) scale(${1 + focus * 0.045})`,
                transformOrigin: 'center',
              }}
            >
              <strong
                style={{
                  fontSize: 34,
                  fontWeight: 950,
                  lineHeight: 1,
                  textTransform: 'uppercase',
                }}
              >
                {step}
              </strong>
            </div>
          )
        })}
      </div>
    </VideoPanel>
  )
}

function MemoryChips({
  dark = false,
  frame,
  items,
  start,
}: {
  dark?: boolean
  frame: number
  items: readonly string[]
  start: number
}) {
  return (
    <div
      style={{
        alignContent: 'center',
        display: 'grid',
        gap: 14,
      }}
    >
      {items.map((item, index) => {
        const progress = appear(frame, start + index * 20, 16)
        const isAccentChip = index % 2 === 0
        const background = getMemoryChipBackground(isAccentChip, dark)
        const color = getMemoryChipColor(isAccentChip, dark)

        return (
          <div
            key={item}
            style={{
              background,
              border: `3px solid ${dark ? '#ffffff' : '#000000'}`,
              color,
              opacity: progress,
              padding: '18px 20px',
              transform: `translateY(${(1 - progress) * 24}px)`,
            }}
          >
            <strong
              style={{
                fontSize: 28,
                fontWeight: 950,
                lineHeight: 1,
                textTransform: 'uppercase',
              }}
            >
              {item}
            </strong>
          </div>
        )
      })}
    </div>
  )
}

function getMemoryChipBackground(isAccentChip: boolean, dark: boolean) {
  if (isAccentChip) {
    return '#ff3000'
  }

  if (dark) {
    return '#ffffff'
  }

  return '#000000'
}

function getMemoryChipColor(isAccentChip: boolean, dark: boolean) {
  if (isAccentChip || dark) {
    return '#000000'
  }

  return '#ffffff'
}

function SectionTitle({
  dark = false,
  kicker,
  title,
}: {
  dark?: boolean
  kicker: string
  title: string
}) {
  return (
    <div>
      <VideoLabel invert={dark}>{kicker}</VideoLabel>
      <p
        style={{
          color: dark ? '#ffffff' : '#000000',
          fontSize: 46,
          fontWeight: 950,
          letterSpacing: 0,
          lineHeight: 0.92,
          margin: '18px 0 0',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </p>
    </div>
  )
}

function SceneStack({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        height: '100%',
        position: 'relative',
      }}
    >
      {children}
    </div>
  )
}

function Scene({
  children,
  frame,
  from,
  to,
}: {
  children: ReactNode
  frame: number
  from: number
  to: number
}) {
  const direction = getSceneDirection(from)
  const enter = interpolate(frame, [from, from + 34], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const exit = interpolate(frame, [to - 30, to], [1, 0], {
    easing: Easing.bezier(0.7, 0, 0.84, 0),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const hold = progressBetween(frame, from + 28, to - 30)
  const opacity = Math.min(enter, exit)
  const x =
    (1 - enter) * direction.enterX +
    hold * direction.holdX +
    (1 - exit) * direction.exitX
  const y =
    (1 - enter) * direction.enterY +
    hold * direction.holdY +
    (1 - exit) * direction.exitY
  const scale =
    direction.scaleFrom +
    enter * (1 - direction.scaleFrom) +
    hold * direction.holdScale +
    (1 - exit) * direction.exitScale

  return (
    <div
      style={{
        height: '100%',
        opacity,
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'absolute',
        transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
        transformOrigin: 'center',
        width: '100%',
      }}
    >
      {children}
    </div>
  )
}

function getSceneDirection(from: number) {
  const index = Math.round(from / 74) % 4

  if (index === 0) {
    return {
      enterX: -10,
      enterY: 0,
      exitScale: -0.012,
      exitX: 12,
      exitY: 0,
      holdScale: 0,
      holdX: 0,
      holdY: 0,
      scaleFrom: 0.985,
    }
  }

  if (index === 1) {
    return {
      enterX: 0,
      enterY: 12,
      exitScale: -0.01,
      exitX: 0,
      exitY: -12,
      holdScale: 0,
      holdX: 0,
      holdY: 0,
      scaleFrom: 0.985,
    }
  }

  if (index === 2) {
    return {
      enterX: 10,
      enterY: 0,
      exitScale: -0.012,
      exitX: -10,
      exitY: 0,
      holdScale: 0,
      holdX: 0,
      holdY: 0,
      scaleFrom: 0.985,
    }
  }

  return {
    enterX: 0,
    enterY: -10,
    exitScale: -0.01,
    exitX: 0,
    exitY: 12,
    holdScale: 0,
    holdX: 0,
    holdY: 0,
    scaleFrom: 0.985,
  }
}

interface StoryProps {
  aspect: LaunchVideoAspect
  frame: number
  layout: VideoLayout
}

function getLaunchVideoAspect(value: unknown): LaunchVideoAspect {
  if (value === '16x9' || value === '4x5' || value === '1x1') {
    return value
  }

  return '1x1'
}

function getLaunchVideoSlug(value: unknown): LaunchVideoSlug {
  if (typeof value === 'string' && value in videoMeta) {
    return value as LaunchVideoSlug
  }

  return '2026-05-18-why-outname-exists'
}

function getWhyFilmLayout(aspect: LaunchVideoAspect): WhyFilmLayout {
  if (aspect === '16x9') {
    return {
      edge: 70,
      finalCaptionSize: 20,
      finalLogoSize: 156,
      finalWordmarkSize: 112,
      fragmentSize: 118,
      giantSize: 124,
      monoSize: 21,
      thesisSize: 112,
    }
  }

  if (aspect === '4x5') {
    return {
      edge: 64,
      finalCaptionSize: 17,
      finalLogoSize: 180,
      finalWordmarkSize: 86,
      fragmentSize: 86,
      giantSize: 92,
      monoSize: 18,
      thesisSize: 78,
    }
  }

  return {
    edge: 56,
    finalCaptionSize: 15,
    finalLogoSize: 152,
    finalWordmarkSize: 74,
    fragmentSize: 72,
    giantSize: 78,
    monoSize: 17,
    thesisSize: 68,
  }
}

function getAgentConfigFilmLayout(
  aspect: LaunchVideoAspect
): AgentConfigFilmLayout {
  if (aspect === '16x9') {
    return {
      captionSize: 22,
      edge: 70,
      finalCaptionSize: 20,
      finalLogoSize: 156,
      finalWordmarkSize: 112,
      fragmentSize: 116,
      giantSize: 118,
      labelSize: 44,
      monoSize: 21,
      optionSize: 54,
      thesisSize: 108,
    }
  }

  if (aspect === '4x5') {
    return {
      captionSize: 19,
      edge: 64,
      finalCaptionSize: 17,
      finalLogoSize: 180,
      finalWordmarkSize: 86,
      fragmentSize: 84,
      giantSize: 86,
      labelSize: 40,
      monoSize: 18,
      optionSize: 48,
      thesisSize: 78,
    }
  }

  return {
    captionSize: 17,
    edge: 56,
    finalCaptionSize: 15,
    finalLogoSize: 152,
    finalWordmarkSize: 74,
    fragmentSize: 72,
    giantSize: 76,
    labelSize: 34,
    monoSize: 17,
    optionSize: 42,
    thesisSize: 68,
  }
}

function getAutonomousRunFilmLayout(
  aspect: LaunchVideoAspect
): AutonomousRunFilmLayout {
  if (aspect === '16x9') {
    return {
      captionSize: 22,
      edge: 70,
      finalCaptionSize: 20,
      finalLogoSize: 156,
      finalWordmarkSize: 112,
      fragmentSize: 112,
      giantSize: 116,
      microSize: 17,
      monoSize: 21,
      taskSize: 92,
      thesisSize: 104,
    }
  }

  if (aspect === '4x5') {
    return {
      captionSize: 19,
      edge: 64,
      finalCaptionSize: 17,
      finalLogoSize: 180,
      finalWordmarkSize: 86,
      fragmentSize: 84,
      giantSize: 88,
      microSize: 16,
      monoSize: 18,
      taskSize: 82,
      thesisSize: 78,
    }
  }

  return {
    captionSize: 17,
    edge: 56,
    finalCaptionSize: 15,
    finalLogoSize: 152,
    finalWordmarkSize: 74,
    fragmentSize: 72,
    giantSize: 76,
    microSize: 14,
    monoSize: 17,
    taskSize: 66,
    thesisSize: 68,
  }
}

function getMemoryFilmLayout(aspect: LaunchVideoAspect): MemoryFilmLayout {
  if (aspect === '16x9') {
    return {
      captionSize: 22,
      edge: 70,
      fileSize: 100,
      finalCaptionSize: 20,
      finalLogoSize: 156,
      finalWordmarkSize: 112,
      fragmentSize: 112,
      giantSize: 116,
      microSize: 18,
      monoSize: 21,
      thesisSize: 104,
    }
  }

  if (aspect === '4x5') {
    return {
      captionSize: 19,
      edge: 64,
      fileSize: 92,
      finalCaptionSize: 17,
      finalLogoSize: 180,
      finalWordmarkSize: 86,
      fragmentSize: 84,
      giantSize: 90,
      microSize: 16,
      monoSize: 18,
      thesisSize: 78,
    }
  }

  return {
    captionSize: 17,
    edge: 56,
    fileSize: 76,
    finalCaptionSize: 15,
    finalLogoSize: 152,
    finalWordmarkSize: 74,
    fragmentSize: 72,
    giantSize: 78,
    microSize: 14,
    monoSize: 17,
    thesisSize: 68,
  }
}

function getComposableFilmLayout(
  aspect: LaunchVideoAspect
): ComposableFilmLayout {
  if (aspect === '16x9') {
    return {
      channelSize: 28,
      chipSize: 26,
      edge: 70,
      finalCaptionSize: 20,
      finalLogoSize: 156,
      finalWordmarkSize: 112,
      fragmentSize: 112,
      giantSize: 118,
      moduleSize: 44,
      monoSize: 21,
      smallSize: 18,
      thesisSize: 108,
    }
  }

  if (aspect === '4x5') {
    return {
      channelSize: 24,
      chipSize: 23,
      edge: 64,
      finalCaptionSize: 17,
      finalLogoSize: 180,
      finalWordmarkSize: 86,
      fragmentSize: 84,
      giantSize: 92,
      moduleSize: 38,
      monoSize: 18,
      smallSize: 16,
      thesisSize: 82,
    }
  }

  return {
    channelSize: 21,
    chipSize: 20,
    edge: 56,
    finalCaptionSize: 15,
    finalLogoSize: 152,
    finalWordmarkSize: 74,
    fragmentSize: 72,
    giantSize: 78,
    moduleSize: 34,
    monoSize: 17,
    smallSize: 14,
    thesisSize: 72,
  }
}

function getLayout(aspect: LaunchVideoAspect): VideoLayout {
  if (aspect === '16x9') {
    return {
      bodyGap: 30,
      ctaSize: 36,
      eyebrowSize: 17,
      footerNoteSize: 16,
      headlineSize: 80,
      padding: 70,
      scenePadding: 30,
      sublineSize: 16,
    }
  }

  if (aspect === '4x5') {
    return {
      bodyGap: 24,
      ctaSize: 32,
      eyebrowSize: 15,
      footerNoteSize: 14,
      headlineSize: 64,
      padding: 52,
      scenePadding: 26,
      sublineSize: 14,
    }
  }

  return {
    bodyGap: 22,
    ctaSize: 29,
    eyebrowSize: 14,
    footerNoteSize: 12,
    headlineSize: 54,
    padding: 50,
    scenePadding: 24,
    sublineSize: 12,
  }
}

function getBrandCloseLayout(aspect: LaunchVideoAspect): BrandCloseLayout {
  if (aspect === '16x9') {
    return {
      captionSize: 20,
      columns: 'auto auto',
      gap: 42,
      logoSize: 156,
      textAlign: 'left',
      wordmarkAlign: 'start',
      wordmarkGap: 18,
      wordmarkSize: 112,
    }
  }

  if (aspect === '4x5') {
    return {
      captionSize: 17,
      columns: '1fr',
      gap: 34,
      logoSize: 180,
      textAlign: 'center',
      wordmarkAlign: 'center',
      wordmarkGap: 18,
      wordmarkSize: 86,
    }
  }

  return {
    captionSize: 15,
    columns: '1fr',
    gap: 30,
    logoSize: 152,
    textAlign: 'center',
    wordmarkAlign: 'center',
    wordmarkGap: 16,
    wordmarkSize: 74,
  }
}
