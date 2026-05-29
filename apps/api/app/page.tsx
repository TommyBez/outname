import type { Metadata } from 'next'

export const metadata: Metadata = {
  description: 'Health landing page for the OUTNA.ME API service.',
  title: 'OUTNA.ME API',
}

export default function ApiHealthPage() {
  return (
    <main>
      <h1>OUTNA.ME API</h1>
    </main>
  )
}
