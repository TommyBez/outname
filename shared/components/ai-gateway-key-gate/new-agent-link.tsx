'use client'

import type { ComponentProps } from 'react'
import { GatedLink } from './gated-link'

type NewAgentLinkProps = Omit<ComponentProps<typeof GatedLink>, 'href'>

export function NewAgentLink(props: NewAgentLinkProps) {
  return <GatedLink href="/agents/new" {...props} />
}
