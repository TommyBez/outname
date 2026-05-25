'use client'

import Link from 'next/link'
import { useAiGatewayKeyGate } from './ai-gateway-key-gate-provider'

export function AiGatewaySetupBanner() {
  const { hasKey } = useAiGatewayKeyGate()
  if (hasKey) {
    return null
  }

  return (
    <div
      className="mb-6 border-2 border-accent bg-accent/10 px-4 py-3 text-sm leading-relaxed"
      role="status"
    >
      <p className="font-bold text-xs uppercase tracking-[0.14em]">
        AI Gateway key required
      </p>
      <p className="mt-2 text-muted-foreground">
        Add your personal Vercel AI Gateway API key in Settings before you can
        use AI features on this page.
      </p>
      <Link
        className="mt-3 inline-flex font-bold text-xs uppercase tracking-[0.14em] underline underline-offset-2"
        href="/settings#ai-gateway"
      >
        Open AI Gateway settings
      </Link>
    </div>
  )
}
