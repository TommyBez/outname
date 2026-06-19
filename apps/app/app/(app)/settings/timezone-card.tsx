'use client'

import {
  syncBrowserTimezoneAction,
  updateUserTimezoneAction,
} from '@outname/auth/settings/actions'
import {
  buildTimezoneOptions,
  formatTimezoneOffsetPreview,
  getBrowserIanaTimeZone,
} from '@outname/shared/timezone-options'
import { Button } from '@outname/ui/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@outname/ui/components/ui/select'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

function timezoneActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Unexpected error'
}

export function TimezoneCard({ timezone }: { timezone: string }) {
  const [selectedTimezone, setSelectedTimezone] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const { refresh } = useRouter()
  const value = selectedTimezone ?? timezone
  const options = useMemo(() => buildTimezoneOptions(timezone), [timezone])
  const offsetPreview = formatTimezoneOffsetPreview(value)
  const hasUnsavedSelection = selectedTimezone !== null && value !== timezone

  function saveTimezone() {
    startTransition(async () => {
      try {
        const result = await updateUserTimezoneAction(value)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success('Timezone saved.')
        refresh()
      } catch (error) {
        toast.error(timezoneActionErrorMessage(error))
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        Heartbeat times of day and daily dreaming use this timezone. Interval
        heartbeats are not affected. Use device timezone saves your
        browser&apos;s zone as an explicit account choice.
      </p>
      <form action={saveTimezone} className="flex max-w-md flex-col gap-3">
        <Select onValueChange={setSelectedTimezone} value={value}>
          <SelectTrigger
            aria-label="Account timezone"
            className="h-10 border border-border"
            id="account-timezone"
          >
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {offsetPreview ? (
          <p className="font-mono text-muted-foreground text-xs">
            Current offset: {offsetPreview}
            {hasUnsavedSelection ? ' · not saved yet' : ''}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} size="sm" type="submit" variant="default">
            {pending ? 'Saving…' : 'Save timezone'}
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const browserTimezone = getBrowserIanaTimeZone()
                  if (!browserTimezone) {
                    toast.error('Could not detect your device timezone.')
                    return
                  }
                  setSelectedTimezone(browserTimezone)
                  const result =
                    await syncBrowserTimezoneAction(browserTimezone)
                  if (!result.ok) {
                    toast.error(result.error)
                    return
                  }
                  toast.success('Timezone set from your device.')
                  refresh()
                } catch (error) {
                  toast.error(timezoneActionErrorMessage(error))
                }
              })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            Use device timezone
          </Button>
        </div>
      </form>
    </div>
  )
}
