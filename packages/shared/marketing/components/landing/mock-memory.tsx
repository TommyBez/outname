import {
  Panel,
  StatusTag,
} from '@outname/shared/marketing/components/landing/mock-kit'
import { cn } from '@outname/ui/lib/utils'

const FILES = [
  { name: 'AGENTS.md', active: false },
  { name: 'IDENTITY.md', active: false },
  { name: 'SOUL.md', active: false },
  { name: 'USER.md', active: true },
  { name: 'heartbeat.log', active: false },
] as const

const USER_MD = `# USER.md
name: Tommaso
ships: OUTNA.ME — hosted agents
prefers: terse, no fluff
timezone: Europe/Rome`

/** Illustrative readable-memory file browser. */
export function MockMemory() {
  return (
    <Panel
      status={<StatusTag tone="outline">readable</StatusTag>}
      title="memory · files"
    >
      <div className="grid sm:grid-cols-[10.5rem_minmax(0,1fr)]">
        <ul className="divide-y-2 divide-border border-foreground sm:border-r-2">
          {FILES.map((file) => (
            <li
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 font-mono text-xs',
                file.active
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground'
              )}
              key={file.name}
            >
              {file.active ? (
                <span aria-hidden className="size-1.5 bg-accent" />
              ) : (
                <span aria-hidden className="size-1.5" />
              )}
              {file.name}
            </li>
          ))}
        </ul>
        <pre className="overflow-x-auto border-foreground border-t-2 px-4 py-3 font-mono text-foreground text-xs leading-relaxed sm:border-t-0">
          {USER_MD}
        </pre>
      </div>
    </Panel>
  )
}
