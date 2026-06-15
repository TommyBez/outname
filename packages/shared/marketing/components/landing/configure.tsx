'use client'

import { MockConfig } from '@outname/shared/marketing/components/landing/mock-config'
import { FeatureRow } from '@outname/shared/marketing/components/landing/mock-kit'

export function Configure() {
  return (
    <FeatureRow
      body="No one giant assistant. Each agent is a small operational unit with a clear role — and everything about it is explicit and editable."
      bullets={[
        {
          t: 'Role & model',
          d: 'One job; your inference provider and model of choice.',
        },
        {
          t: 'Bootstrap files',
          d: 'AGENTS.md, IDENTITY.md, SOUL.md, and USER.md seed who it is.',
        },
        {
          t: 'Schedule',
          d: 'Heartbeat and dreaming runs on a cadence you set.',
        },
        {
          t: 'Reviewed',
          d: 'Guided creation drafts it; you approve before it saves.',
        },
      ]}
      id="configure"
      index="02"
      label="Configure"
      title="An agent is what you configure."
      visual={<MockConfig />}
    />
  )
}
