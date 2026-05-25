'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { useAiGatewayKeyGate } from './ai-gateway-key-gate-provider'

type GatedLinkProps = ComponentProps<typeof Link>

export function GatedLink({ onClick, href, ...props }: GatedLinkProps) {
  const { requireAiGatewayKey } = useAiGatewayKeyGate()

  return (
    <Link
      href={href}
      onClick={(event) => {
        if (!requireAiGatewayKey()) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
      {...props}
    />
  )
}
