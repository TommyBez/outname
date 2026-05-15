import type { CSSProperties } from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import {
  type HeartbeatEvent,
  heartbeatEvents,
  heartbeatStats,
} from '@/marketing/data/heartbeat-demo'
import { appear, progressBetween, translateIn } from './animation'
import { VideoLabel, VideoPanel, VideoTag } from './video-primitives'

export type ScheduledRunAspect = '16x9' | '4x5' | '1x1'

export type ScheduledRunDemoProps = Record<string, unknown>

const TRACE_START_FRAME = 84
const EVENT_GAP_FRAMES = 42
const CTA_START_FRAME = 588

const narrativeSteps = [
  {
    detail: 'daily.triage queued',
    event: 'cron.fire',
    id: 'trigger',
    label: 'Scheduled run fires',
    time: '06:00',
  },
  {
    detail: '14 threads scanned · 2 flagged',
    event: 'slack.read',
    id: 'queue',
    label: 'Queue check',
    time: '06:00',
  },
  {
    detail: 'calendar conflict spotted · draft sent',
    event: 'cal.draft',
    id: 'tool',
    label: 'Tool runs',
    time: '09:14',
  },
  {
    detail: '+ skip auto-summary on Sundays',
    event: 'memory.write',
    id: 'memory',
    label: 'Memory updates',
    time: '06:01',
  },
  {
    detail: 'research-synthesizer · 4.2s',
    event: 'subagent.call',
    id: 'subagent',
    label: 'Sub-agent trace',
    time: '11:02',
  },
  {
    detail: 'timeline remains inspectable',
    event: 'trace.persist',
    id: 'trace',
    label: 'Readable history',
    time: 'done',
  },
] as const

const traceEvents = heartbeatEvents.slice(0, 7)

export function ScheduledRunDemo(props: ScheduledRunDemoProps) {
  const frame = useCurrentFrame()
  const aspect = getScheduledRunAspect(props.aspect)
  const isWide = aspect === '16x9'
  const padding = isWide ? 72 : 54
  const mainGap = isWide ? 34 : 24
  const headlineSize = getHeadlineSize(aspect)
  const visibleTraceCount = getVisibleTraceCount(frame)
  const visibleTraceEvents = traceEvents.slice(0, visibleTraceCount)
  const activeStepIndex = Math.min(
    Math.max(0, visibleTraceCount - 1),
    narrativeSteps.length - 1
  )
  const activeStep = narrativeSteps[activeStepIndex] ?? narrativeSteps[0]
  const traceProgress = progressBetween(frame, TRACE_START_FRAME, 540)
  const ctaProgress = appear(frame, CTA_START_FRAME, 28)
  const contentOpacity = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      className="outname-video-root outname-video-grid"
      style={{
        opacity: contentOpacity,
        padding,
      }}
    >
      <div
        style={{
          display: 'grid',
          gap: mainGap,
          gridTemplateRows: 'auto minmax(0, 1fr) auto',
          height: '100%',
          width: '100%',
        }}
      >
        <Header
          activeStep={activeStep}
          aspect={aspect}
          frame={frame}
          headlineSize={headlineSize}
          isWide={isWide}
        />

        <main
          style={{
            display: 'grid',
            gap: mainGap,
            gridTemplateColumns: isWide ? '1.08fr 0.92fr' : '1fr',
            minHeight: 0,
          }}
        >
          <TimelinePanel
            activeStepId={activeStep.id}
            aspect={aspect}
            frame={frame}
          />
          <TracePanel
            aspect={aspect}
            events={visibleTraceEvents}
            frame={frame}
            isWide={isWide}
            traceProgress={traceProgress}
          />
        </main>

        <Footer aspect={aspect} ctaProgress={ctaProgress} />
      </div>
    </AbsoluteFill>
  )
}

function Header({
  activeStep,
  aspect,
  frame,
  headlineSize,
  isWide,
}: {
  activeStep: (typeof narrativeSteps)[number]
  aspect: ScheduledRunAspect
  frame: number
  headlineSize: number
  isWide: boolean
}) {
  const headerColumns = isWide ? 'minmax(0, 1fr) auto' : '1fr'
  const headerStyle = translateIn(frame, 8, 24)

  return (
    <header
      style={{
        ...headerStyle,
        alignItems: isWide ? 'end' : 'start',
        borderTop: '5px solid #000000',
        display: 'grid',
        gap: 24,
        gridTemplateColumns: headerColumns,
        paddingTop: 18,
      }}
    >
      <div>
        <VideoLabel>OUTNA.ME / scheduled runtime</VideoLabel>
        <h1
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: headlineSize,
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 0.86,
            margin: '18px 0 0',
            maxWidth: aspect === '16x9' ? 1050 : 840,
            textTransform: 'uppercase',
          }}
        >
          Scheduled work, readable history.
        </h1>
      </div>
      <div
        style={{
          alignItems: 'flex-end',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <VideoTag active>{activeStep.label}</VideoTag>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 18,
            fontWeight: 700,
            textAlign: isWide ? 'right' : 'left',
            textTransform: 'uppercase',
          }}
        >
          {activeStep.time} · {activeStep.event}
        </span>
      </div>
    </header>
  )
}

function TimelinePanel({
  activeStepId,
  aspect,
  frame,
}: {
  activeStepId: string
  aspect: ScheduledRunAspect
  frame: number
}) {
  return (
    <CompactTimelinePanel
      activeStepId={activeStepId}
      aspect={aspect}
      frame={frame}
    />
  )
}

function CompactTimelinePanel({
  activeStepId,
  aspect,
  frame,
}: {
  activeStepId: string
  aspect: ScheduledRunAspect
  frame: number
}) {
  const layout = getCompactTimelineLayout(aspect)

  return (
    <VideoPanel
      style={{
        display: 'grid',
        gap: layout.panelGap,
        padding: layout.panelPadding,
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <VideoLabel>Runtime sequence</VideoLabel>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: layout.headerNoteSize,
            fontWeight: 800,
            textTransform: 'uppercase',
          }}
        >
          muted asset
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gap: layout.gridGap,
          gridTemplateColumns: '1fr 1fr',
        }}
      >
        {narrativeSteps.map((step, index) => {
          const startFrame = TRACE_START_FRAME + index * EVENT_GAP_FRAMES
          const progress = appear(frame, startFrame, 18)
          const isActive = step.id === activeStepId

          return (
            <div
              key={step.id}
              style={{
                alignItems: 'center',
                background: isActive ? '#ff3000' : '#ffffff',
                border: '2px solid #000000',
                display: 'grid',
                gap: layout.cardGap,
                gridTemplateColumns: `${layout.timeWidth}px minmax(0, 1fr)`,
                minHeight: layout.cardMinHeight,
                opacity: progress,
                padding: layout.cardPadding,
                transform: `translateY(${(1 - progress) * 8}px)`,
              }}
            >
              <span
                style={{
                  background: isActive ? '#000000' : '#f2f2f2',
                  color: isActive ? '#ffffff' : '#000000',
                  fontFamily: 'var(--font-mono)',
                  fontSize: layout.timeSize,
                  fontWeight: 900,
                  padding: layout.timePadding,
                  textAlign: 'center',
                }}
              >
                {step.time}
              </span>
              <span
                style={{
                  fontSize: layout.labelSize,
                  fontWeight: 950,
                  lineHeight: 0.92,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </VideoPanel>
  )
}

function TracePanel({
  aspect,
  events,
  frame,
  isWide,
  traceProgress,
}: {
  aspect: ScheduledRunAspect
  events: readonly HeartbeatEvent[]
  frame: number
  isWide: boolean
  traceProgress: number
}) {
  const padding = aspect === '16x9' ? 28 : 24
  const maxRows = getTraceRowLimit(aspect, isWide)
  const visibleRows = events.slice(-maxRows)

  return (
    <VideoPanel
      emphasis
      style={{
        display: 'grid',
        gap: 22,
        gridTemplateRows: 'auto auto minmax(0, 1fr)',
        minHeight: 0,
        padding,
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <VideoLabel invert>Readable trace</VideoLabel>
        <span
          style={{
            color: '#ffffff',
            fontFamily: 'var(--font-mono)',
            fontSize: 17,
            fontWeight: 900,
            textTransform: 'uppercase',
          }}
        >
          {Math.round(traceProgress * 100)}%
        </span>
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.2)',
          height: 8,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: '#ff3000',
            height: '100%',
            transform: `scaleX(${traceProgress})`,
            transformOrigin: 'left center',
            width: '100%',
          }}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gap: aspect === '16x9' ? 12 : 10,
          minHeight: 0,
        }}
      >
        {visibleRows.map((entry) => (
          <TraceRow
            aspect={aspect}
            entry={entry}
            frame={frame}
            key={`${entry.event}-${entry.time}`}
          />
        ))}
        {aspect === '4x5' ? <PendingRow aspect={aspect} frame={frame} /> : null}
      </div>
    </VideoPanel>
  )
}

function TraceRow({
  aspect,
  entry,
  frame,
}: {
  aspect: ScheduledRunAspect
  entry: HeartbeatEvent
  frame: number
}) {
  const eventIndex = traceEvents.findIndex(
    (candidate) =>
      candidate.event === entry.event && candidate.time === entry.time
  )
  const rowFrame =
    TRACE_START_FRAME + Math.max(0, eventIndex) * EVENT_GAP_FRAMES
  const rowStyle = translateIn(frame, rowFrame, 18)
  const isMemory = entry.emphasis === 'memory'
  const isHighlight = entry.emphasis === 'highlight'
  const isCompact = aspect !== '16x9'

  return (
    <div
      style={{
        ...rowStyle,
        alignItems: 'center',
        border: '2px solid rgba(255,255,255,0.32)',
        display: 'grid',
        gap: isCompact ? 9 : 12,
        gridTemplateColumns: isCompact
          ? '56px 128px minmax(0, 1fr)'
          : '72px 150px minmax(0, 1fr)',
        minHeight: isCompact ? 46 : 58,
        padding: isCompact ? '8px 10px' : '10px 12px',
      }}
    >
      <span
        style={{
          color: '#ffffff',
          fontFamily: 'var(--font-mono)',
          fontSize: isCompact ? 14 : 18,
          fontWeight: 950,
        }}
      >
        {entry.time}
      </span>
      <span
        style={{
          background: getTraceTone(isMemory, isHighlight),
          color: isMemory || isHighlight ? '#000000' : '#ffffff',
          fontFamily: 'var(--font-mono)',
          fontSize: isCompact ? 11 : 14,
          fontWeight: 900,
          overflow: 'hidden',
          padding: isCompact ? '6px 7px' : '8px 9px',
          textOverflow: 'ellipsis',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {entry.event}
      </span>
      <span
        style={{
          color: 'rgba(255,255,255,0.84)',
          fontFamily: 'var(--font-mono)',
          fontSize: isCompact ? 13 : 17,
          fontWeight: 700,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {entry.detail}
      </span>
    </div>
  )
}

function PendingRow({
  aspect,
  frame,
}: {
  aspect: ScheduledRunAspect
  frame: number
}) {
  const progress = appear(frame, 548, 24)
  const isCompact = aspect !== '16x9'

  return (
    <div
      style={{
        alignItems: 'center',
        border: '2px dashed rgba(255,255,255,0.28)',
        color: 'rgba(255,255,255,0.58)',
        display: 'flex',
        fontFamily: 'var(--font-mono)',
        fontSize: isCompact ? 12 : 16,
        fontWeight: 800,
        justifyContent: 'space-between',
        minHeight: isCompact ? 42 : 54,
        opacity: progress,
        padding: isCompact ? '8px 10px' : '10px 12px',
        textTransform: 'uppercase',
      }}
    >
      <span>human confirmation</span>
      <span>none required</span>
    </div>
  )
}

function Footer({
  aspect,
  ctaProgress,
}: {
  aspect: ScheduledRunAspect
  ctaProgress: number
}) {
  const footerStyle = getFooterStyle(aspect, ctaProgress)

  return (
    <footer
      style={{
        ...footerStyle,
        alignItems: 'center',
        borderTop: '3px solid #000000',
        display: 'grid',
        gap: 18,
        gridTemplateColumns: aspect === '16x9' ? '1fr auto' : '1fr',
        paddingTop: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {heartbeatStats.map((stat) => (
          <VideoTag key={stat.label}>
            {stat.value} {stat.label}
          </VideoTag>
        ))}
      </div>
      <div
        style={{
          alignItems: aspect === '16x9' ? 'flex-end' : 'flex-start',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <p
          style={{
            fontSize: aspect === '16x9' ? 40 : 32,
            fontWeight: 950,
            lineHeight: 0.9,
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          OUTNA.ME / waitlist open
        </p>
      </div>
    </footer>
  )
}

function getVisibleTraceCount(frame: number) {
  const rawCount =
    Math.floor((frame - TRACE_START_FRAME) / EVENT_GAP_FRAMES) + 1
  return Math.min(traceEvents.length, Math.max(0, rawCount))
}

function getScheduledRunAspect(value: unknown): ScheduledRunAspect {
  if (value === '4x5' || value === '1x1') {
    return value
  }
  return '16x9'
}

function getHeadlineSize(aspect: ScheduledRunAspect) {
  if (aspect === '16x9') {
    return 94
  }
  if (aspect === '4x5') {
    return 72
  }
  return 64
}

function getCompactTimelineLayout(aspect: ScheduledRunAspect) {
  if (aspect === '16x9') {
    return {
      cardGap: 12,
      cardMinHeight: 64,
      cardPadding: '12px 14px',
      gridGap: 12,
      headerNoteSize: 15,
      labelSize: 22,
      panelGap: 16,
      panelPadding: 26,
      timePadding: '8px 6px',
      timeSize: 13,
      timeWidth: 58,
    } as const
  }

  if (aspect === '4x5') {
    return {
      cardGap: 10,
      cardMinHeight: 58,
      cardPadding: '10px 12px',
      gridGap: 10,
      headerNoteSize: 13,
      labelSize: 19,
      panelGap: 15,
      panelPadding: 24,
      timePadding: '7px 5px',
      timeSize: 11,
      timeWidth: 52,
    } as const
  }

  return {
    cardGap: 8,
    cardMinHeight: 48,
    cardPadding: '8px 9px',
    gridGap: 8,
    headerNoteSize: 13,
    labelSize: 15,
    panelGap: 16,
    panelPadding: 22,
    timePadding: '6px 4px',
    timeSize: 10,
    timeWidth: 44,
  } as const
}

function getTraceRowLimit(aspect: ScheduledRunAspect, isWide: boolean) {
  if (isWide) {
    return 6
  }
  if (aspect === '4x5') {
    return 4
  }
  return 2
}

function getTraceTone(isMemory: boolean, isHighlight: boolean) {
  if (isMemory) {
    return '#ff3000'
  }
  if (isHighlight) {
    return '#ffffff'
  }
  return '#000000'
}

function getFooterStyle(
  aspect: ScheduledRunAspect,
  ctaProgress: number
): CSSProperties {
  const offset = (1 - ctaProgress) * 20

  if (aspect === '16x9') {
    return {
      opacity: Math.max(0.72, ctaProgress),
      transform: `translateY(${offset}px)`,
    }
  }

  return {
    opacity: Math.max(0.82, ctaProgress),
    transform: `translateY(${offset}px)`,
  }
}
