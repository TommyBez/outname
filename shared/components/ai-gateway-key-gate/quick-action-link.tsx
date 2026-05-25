'use client'

import Link from 'next/link'
import { GatedLink } from './gated-link'

const NEW_AGENT_PATH = '/agents/new'

const QUICK_ACTION_CLASS =
  'inline-flex h-10 items-center justify-center border-2 border-foreground px-3 font-bold text-[10px] uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background'

export function QuickActionLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  if (href === NEW_AGENT_PATH) {
    return (
      <GatedLink className={QUICK_ACTION_CLASS} href={href}>
        {label}
      </GatedLink>
    )
  }

  return (
    <Link className={QUICK_ACTION_CLASS} href={href}>
      {label}
    </Link>
  )
}
