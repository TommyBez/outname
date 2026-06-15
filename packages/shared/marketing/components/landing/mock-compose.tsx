import {
  Chip,
  Panel,
  StatusTag,
} from '@outname/shared/marketing/components/landing/mock-kit'
import { SwissLabel } from '@outname/shared/marketing/components/landing/section-kit'
import type { ReactNode } from 'react'

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3.5">
      <SwissLabel className="text-muted-foreground">{label}</SwissLabel>
      <div className="mt-2.5">{children}</div>
    </div>
  )
}

/** Illustrative composable-capabilities panel. */
export function MockCompose() {
  return (
    <Panel
      status={<StatusTag tone="muted">attached</StatusTag>}
      title="agent · capabilities"
    >
      <div className="divide-y-2 divide-border">
        <Block label="Tools">
          <div className="flex flex-wrap gap-1.5">
            <Chip on>Resend</Chip>
            <Chip on>GitHub</Chip>
            <Chip on>X</Chip>
            <Chip on>PostHog</Chip>
            <Chip className="text-muted-foreground">Cal.com</Chip>
            <Chip className="text-muted-foreground">Browser</Chip>
          </div>
        </Block>
        <Block label="Sub-agents">
          <div className="font-mono text-xs">
            <span className="font-bold">atlas</span>
            <div className="mt-1.5 ml-1 flex flex-col gap-1 border-border border-l-2 pl-3 text-muted-foreground">
              <span>→ researcher</span>
              <span>→ writer</span>
            </div>
          </div>
        </Block>
        <Block label="Skills">
          <div className="flex flex-wrap gap-1.5">
            <Chip on>seo-audit</Chip>
            <Chip on>changelog</Chip>
          </div>
        </Block>
      </div>
    </Panel>
  )
}
