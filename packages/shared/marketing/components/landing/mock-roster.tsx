import {
  Dot,
  Panel,
  StatusTag,
} from '@outname/shared/marketing/components/landing/mock-kit'

const AGENTS = [
  {
    name: 'atlas',
    role: 'Growth operator',
    model: 'opus-4-8',
    status: 'Running',
    tone: 'accent',
    dot: 'bg-accent',
    running: true,
  },
  {
    name: 'vega',
    role: 'Inbox triage',
    model: 'sonnet-4-6',
    status: 'Next 12:00',
    tone: 'muted',
    dot: 'bg-muted-foreground',
    running: false,
  },
  {
    name: 'probe',
    role: 'Research',
    model: 'opus-4-8',
    status: 'Dreaming',
    tone: 'outline',
    dot: 'border-2 border-foreground bg-background',
    running: false,
  },
] as const

/** Illustrative "control plane" roster used as the hero visual. */
export function MockRoster() {
  return (
    <Panel
      status={<StatusTag tone="muted">3 agents</StatusTag>}
      title="control plane"
    >
      <ul className="divide-y-2 divide-border">
        {AGENTS.map((agent) => (
          <li className="flex items-center gap-3 px-4 py-3.5" key={agent.name}>
            <Dot className={agent.dot} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-bold font-mono text-sm">
                  {agent.name}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {agent.role}
                </span>
              </div>
              {agent.running ? (
                <div className="mt-2 h-1 overflow-hidden bg-secondary">
                  <div className="h-full w-1/3 animate-indeterminate bg-accent" />
                </div>
              ) : null}
            </div>
            <span className="hidden font-mono text-[0.625rem] text-muted-foreground md:inline">
              {agent.model}
            </span>
            <StatusTag tone={agent.tone}>{agent.status}</StatusTag>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
