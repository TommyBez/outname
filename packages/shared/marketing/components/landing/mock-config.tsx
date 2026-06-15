import {
  Chip,
  Panel,
  StatusTag,
} from '@outname/shared/marketing/components/landing/mock-kit'
import { ChevronDown } from 'lucide-react'

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 px-4 py-3">
      <span className="font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.14em]">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Illustrative agent configuration panel. */
export function MockConfig() {
  return (
    <Panel
      status={<StatusTag tone="accent">draft</StatusTag>}
      title="agent · config"
    >
      <dl className="divide-y-2 divide-border">
        <Row label="Role">
          <div className="border-2 border-border px-3 py-1.5 font-mono text-sm">
            Growth operator
          </div>
        </Row>
        <Row label="Model">
          <div className="flex items-center justify-between border-2 border-border px-3 py-1.5 font-mono text-sm">
            <span>claude-opus-4-8</span>
            <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
          </div>
        </Row>
        <Row label="Schedule">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-5 w-9 items-center border-2 border-foreground bg-accent px-0.5"
            >
              <span className="ml-auto size-3 bg-background" />
            </span>
            <span className="font-mono text-sm">Heartbeat · 60 min</span>
          </div>
        </Row>
        <Row label="Tools">
          <div className="flex flex-wrap gap-1.5">
            <Chip on>Resend</Chip>
            <Chip on>GitHub</Chip>
            <Chip on>X</Chip>
            <Chip className="text-muted-foreground">+ add</Chip>
          </div>
        </Row>
        <Row label="Budget">
          <span className="font-mono text-sm">$20 / day</span>
        </Row>
      </dl>
    </Panel>
  )
}
