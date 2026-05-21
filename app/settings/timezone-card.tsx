'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  syncBrowserTimezoneAction,
  updateUserTimezoneAction,
} from '@/app/settings/actions'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildTimezoneOptions,
  formatTimezoneOffsetPreview,
  getBrowserIanaTimeZone,
} from '@/shared/timezone-options'

function timezoneActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Unexpected error'
}

export function TimezoneCard({ timezone }: { timezone: string }) {
  const [value, setValue] = useState(timezone)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const options = useMemo(() => buildTimezoneOptions(timezone), [timezone])
  const offsetPreview = formatTimezoneOffsetPreview(value)

  useEffect(() => {
    setValue(timezone)
  }, [timezone])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        Heartbeat times of day and daily dreaming use this timezone. Interval
        heartbeats are not affected.
      </p>
      <form
        className="flex max-w-md flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          startTransition(async () => {
            try {
              const result = await updateUserTimezoneAction(value)
              if (!result.ok) {
                toast.error(result.error)
                return
              }
              toast.success('Timezone saved.')
              router.refresh()
            } catch (error) {
              toast.error(timezoneActionErrorMessage(error))
            }
          })
        }}
      >
        <Select onValueChange={setValue} value={value}>
          <SelectTrigger
            aria-label="Account timezone"
            className="h-10 border-2 border-foreground"
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
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} size="sm" type="submit" variant="default">
            Save timezone
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
                  setValue(browserTimezone)
                  const result =
                    await syncBrowserTimezoneAction(browserTimezone)
                  if (!result.ok) {
                    toast.error(result.error)
                    return
                  }
                  toast.success('Timezone set from your device.')
                  router.refresh()
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
