'use client'

import { FeatureRow } from '@outname/shared/marketing/components/landing/mock-kit'
import { MockMemory } from '@outname/shared/marketing/components/landing/mock-memory'

export function Memory() {
  return (
    <FeatureRow
      body="Not automatic learning, not a vector black box. The agent's memory is plain files in a persistent sandbox — readable, editable, and reused by the next run."
      bullets={[
        {
          t: 'Readable files',
          d: 'Open, edit, or correct exactly what it knows.',
        },
        {
          t: 'Carries forward',
          d: 'Each run can write context the next run reads.',
        },
        {
          t: 'Identity + logs',
          d: 'Bootstrap files plus a timeline of what happened.',
        },
      ]}
      id="memory"
      index="04"
      label="Memory"
      title="Memory you can actually read."
      tone="secondary"
      visual={<MockMemory />}
    />
  )
}
