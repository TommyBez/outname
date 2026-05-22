'use client'

import { useEffect, useState } from 'react'
import { useUserTimezone } from '@/shared/components/user-timezone-context'
import { formatLongDateInTimeZone } from '@/shared/format-timezone'

export function TodayDate() {
  const timeZone = useUserTimezone()
  const [label, setLabel] = useState('')
  useEffect(() => {
    setLabel(formatLongDateInTimeZone(new Date(), timeZone))
  }, [timeZone])
  // Reserve vertical space so the header doesn't shift when it hydrates.
  return <span className="inline-block min-h-[1em]">{label}</span>
}
