'use client'

import { useUserTimezone } from '@/shared/components/user-timezone-context'
import { formatAccountTimezoneLabel } from '@/shared/format-timezone'

export function AccountTimezoneCaption() {
  const timeZone = useUserTimezone()
  return (
    <span className="font-mono text-muted-foreground">
      {formatAccountTimezoneLabel(timeZone)}
    </span>
  )
}
