import {
  Panel,
  StatusTag,
} from '@outname/shared/marketing/components/landing/mock-kit'

const EVENTS = [
  {
    time: '02:14',
    type: 'Dreaming',
    summary: 'Reviewed memory, updated USER.md',
    status: 'Done',
    tone: 'outline',
  },
  {
    time: '08:00',
    type: 'Heartbeat',
    summary: 'Triaged 12 overnight items',
    status: 'Done',
    tone: 'outline',
  },
  {
    time: '12:00',
    type: 'Heartbeat',
    summary: 'Pushing 3 stalled follow-ups',
    status: 'Running',
    tone: 'accent',
  },
  {
    time: '18:00',
    type: 'Heartbeat',
    summary: 'Draft the daily digest',
    status: 'Queued',
    tone: 'muted',
  },
] as const

/** Illustrative durable event ledger. */
export function MockLedger() {
  return (
    <Panel
      status={<StatusTag tone="muted">today</StatusTag>}
      title="event ledger"
    >
      <ul className="divide-y-2 divide-border">
        {EVENTS.map((event) => (
          <li
            className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
            key={event.time}
          >
            <span className="font-mono text-accent text-xs tabular-nums">
              {event.time}
            </span>
            <div className="min-w-0">
              <div className="font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.14em]">
                {event.type}
              </div>
              <div className="truncate text-sm">{event.summary}</div>
            </div>
            <StatusTag tone={event.tone}>{event.status}</StatusTag>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
