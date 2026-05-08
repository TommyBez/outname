'use client'

import { useEffect, useState } from 'react'
import { formatLongDate } from '@/shared/server/format'

export function TodayDate() {
  const [label, setLabel] = useState('')
  useEffect(() => {
    setLabel(formatLongDate(new Date()))
  }, [])
  // Reserve vertical space so the header doesn't shift when it hydrates.
  return <span className="inline-block min-h-[1em]">{label}</span>
}
