import type { ReactNode } from 'react'
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

const CTA_START_FRAME = 420
const BODY_START_FRAME = 76

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
    cta: 'scheduled work / no manual nudge',
    eyebrow: 'autonomous run',
    headline: 'Work starts without me.',
    subline: 'Schedule. Tools. Memory.',
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

  return (
    <AbsoluteFill
      className="outname-video-root outname-video-grid"
      style={{ padding: layout.padding }}
    >
      <VideoShell aspect={aspect} frame={frame} layout={layout} meta={meta}>
        {renderStory(slug, aspect, frame, layout)}
      </VideoShell>
      <BrandClosingOverlay aspect={aspect} frame={frame} />
    </AbsoluteFill>
  )
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
  const progress = appear(frame, 488, 24)
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
  return (
    <div style={{ minHeight: 0, position: 'relative' }}>
      {items.map(([title, detail], index) => {
        const progress = appear(frame, 90 + index * 18, 18)
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
              transform: `translate(${(1 - progress) * 34}px, ${(1 - progress) * 10}px)`,
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

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: compact ? 10 : 22,
        gridTemplateRows: 'auto 1fr auto',
        minHeight: 0,
        opacity: progress,
        padding: compact ? 14 : 24,
        transform: `translateY(${(1 - progress) * 28}px)`,
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
              padding: compact ? '8px 10px' : '14px 16px',
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
  return (
    <div
      style={{
        alignContent: 'center',
        display: 'grid',
        gap: 16,
        minHeight: 0,
      }}
    >
      {[
        ['08:30', 'Research resumes'],
        ['12:00', 'Queue checked'],
        ['17:30', 'Draft ready'],
      ].map(([time, label], index) => {
        const progress = appear(frame, 326 + index * 22, 18)
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
              transform: `translateX(${(1 - progress) * 48}px)`,
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
  return (
    <VideoPanel
      emphasis
      style={{
        display: 'grid',
        gap: 14,
        padding: 26,
      }}
    >
      <VideoLabel invert>agents</VideoLabel>
      {['Research', 'Writing', 'Ops'].map((agent, index) => {
        const progress = appear(frame, 88 + index * 20, 18)
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
              transform: `translateX(${(1 - progress) * -28}px)`,
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

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 20,
        gridTemplateColumns: aspect === '16x9' ? '0.8fr 1.2fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
      }}
    >
      <SectionTitle kicker="workbench" title="Configuration first." />
      <div style={{ display: 'grid', gap: 14 }}>
        {fields.map(([label, value], index) => {
          const progress = appear(frame, 188 + index * 22, 16)
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
                transform: `translateX(${(1 - progress) * 32}px)`,
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

  return (
    <div
      style={{
        alignItems: 'center',
        border: '3px solid #ffffff',
        display: 'grid',
        gap: 22,
        gridTemplateColumns: '1fr auto',
        padding: 28,
      }}
    >
      <div>
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
          transform: `scale(${0.92 + pulse * 0.08})`,
        }}
      >
        09:00
      </div>
    </div>
  )
}

function ScheduleTrigger({ aspect, frame, layout }: StoryProps) {
  const pulse = progressBetween(frame, 92, 168)

  return (
    <VideoPanel
      style={{
        alignItems: 'center',
        display: 'grid',
        gap: 28,
        gridTemplateColumns: aspect === '16x9' ? '0.82fr 1.18fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
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

  return (
    <VideoPanel
      emphasis
      style={{
        display: 'grid',
        gap: 22,
        height: '100%',
        padding: layout.scenePadding,
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
          return (
            <PipelineNode
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
  index,
  label,
  progress,
}: {
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
        transform: `translateY(${(1 - progress) * 28}px)`,
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
  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 22,
        gridTemplateColumns: aspect === '16x9' ? '0.8fr 1.2fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
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
  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 18,
        height: '100%',
        padding: layout.scenePadding,
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
          return (
            <div
              key={run}
              style={{
                background: index === 2 ? '#ff3000' : '#ffffff',
                border: '3px solid #000000',
                opacity: progress,
                padding: 22,
                transform: `translateY(${(1 - progress) * 26}px)`,
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
  return (
    <VideoPanel
      emphasis
      style={{
        display: 'grid',
        gap: 24,
        gridTemplateColumns: aspect === '16x9' ? '0.85fr 1.15fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
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
  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 20,
        gridTemplateColumns: aspect === '16x9' ? '1fr 1fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
      }}
    >
      <SectionTitle kicker="outcome" title="Less explaining." />
      <div style={{ display: 'grid', gap: 14 }}>
        {['Context dump', 'Tone reminder', 'Start from memory'].map(
          (line, index) => {
            const progress = appear(frame, 344 + index * 18, 16)
            const removed = index < 2
            return (
              <div
                key={line}
                style={{
                  background: removed ? '#f4f4f4' : '#ff3000',
                  border: '3px solid #000000',
                  color: removed ? '#8a8a8a' : '#000000',
                  opacity: removed ? 1 - progress * 0.62 : progress,
                  padding: '18px 20px',
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

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 24,
        gridTemplateColumns: aspect === '16x9' ? '0.85fr 1.15fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
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
          return (
            <div
              key={item}
              style={{
                background: index === 1 ? '#ff3000' : '#ffffff',
                border: '3px solid #000000',
                opacity: progress,
                padding: 22,
                transform: `scale(${0.94 + progress * 0.06})`,
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
  return (
    <VideoPanel
      emphasis
      style={{
        display: 'grid',
        gap: 24,
        gridTemplateColumns: aspect === '16x9' ? '1fr 0.8fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
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
        return (
          <div
            key={channel}
            style={{
              background: index === 3 ? '#ff3000' : '#ffffff',
              border: '3px solid #ffffff',
              color: '#000000',
              opacity: progress,
              padding: 24,
              transform: `translateX(${(1 - progress) * (index % 2 === 0 ? -34 : 34)}px)`,
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
  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 20,
        gridTemplateColumns: aspect === '16x9' ? '0.9fr 1.1fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
      }}
    >
      <SectionTitle kicker="next pieces" title="MCP. Skills. Templates." />
      <div style={{ display: 'grid', gap: 14 }}>
        {['MCP', 'Skills', 'Templates'].map((slot, index) => {
          const progress = appear(frame, 350 + index * 22, 16)
          return (
            <div
              key={slot}
              style={{
                background: index === 0 ? '#ff3000' : '#ffffff',
                border: '3px dashed #000000',
                opacity: progress,
                padding: '22px 24px',
                transform: `translateY(${(1 - progress) * 24}px)`,
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

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 22,
        gridTemplateColumns: aspect === '16x9' ? '0.8fr 1.2fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
      }}
    >
      <SectionTitle kicker="platform stack" title="Primitives, not glue." />
      <div style={{ display: 'grid', gap: 10 }}>
        {layers.map((layer, index) => {
          const progress = appear(frame, 102 + index * 20, 18)
          return (
            <div
              key={layer}
              style={{
                background: index === 2 ? '#ff3000' : '#000000',
                border: '3px solid #000000',
                color: index === 2 ? '#000000' : '#ffffff',
                opacity: progress,
                padding: '16px 20px',
                transform: `translateX(${(1 - progress) * 42}px)`,
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
  return (
    <VideoPanel
      emphasis
      style={{
        display: 'grid',
        gap: 20,
        height: '100%',
        padding: layout.scenePadding,
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
            return (
              <div
                key={label}
                style={{
                  background: index === 3 ? '#ff3000' : '#ffffff',
                  border: '3px solid #ffffff',
                  color: '#000000',
                  opacity: progress,
                  padding: 18,
                  transform: `translateY(${(1 - progress) * 30}px)`,
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
  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: 22,
        gridTemplateColumns: aspect === '16x9' ? '0.85fr 1.15fr' : '1fr',
        height: '100%',
        padding: layout.scenePadding,
      }}
    >
      <SectionTitle kicker="open source soon" title="Fork. Deploy. Own." />
      <div style={{ display: 'grid', gap: 14 }}>
        {['Fork', 'Env', 'Vercel'].map((step, index) => {
          const progress = appear(frame, 350 + index * 22, 16)
          return (
            <div
              key={step}
              style={{
                background: index === 2 ? '#ff3000' : '#ffffff',
                border: '3px solid #000000',
                opacity: progress,
                padding: '20px 22px',
                transform: `translateX(${(1 - progress) * 36}px)`,
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
  const enter = interpolate(frame, [from, from + 18], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const exit = interpolate(frame, [to - 18, to], [1, 0], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const opacity = Math.min(enter, exit)
  const y = (1 - enter) * 34 + (1 - exit) * -26

  return (
    <div
      style={{
        height: '100%',
        opacity,
        pointerEvents: 'none',
        position: 'absolute',
        transform: `translateY(${y}px)`,
        width: '100%',
      }}
    >
      {children}
    </div>
  )
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
