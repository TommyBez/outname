import { MAX_DAILY_SCHEDULE_TIMES } from '@outname/shared/agent-schedule'
import { Button } from '@outname/ui/components/ui/button'
import { Input } from '@outname/ui/components/ui/input'
import { Label } from '@outname/ui/components/ui/label'
import { Plus, X } from 'lucide-react'

export function HeartbeatDailyTimesEditor({
  id,
  setTimes,
  times,
  timezoneLabel,
}: {
  id: string
  setTimes: (value: string[]) => void
  times: string[]
  timezoneLabel: string
}) {
  const visibleTimes = times.length > 0 ? times : ['09:00']
  const rows = scheduleTimeRows(id, visibleTimes)

  function updateTime(index: number, value: string) {
    const next = visibleTimes.slice()
    next[index] = value
    setTimes(next)
  }

  function addTime() {
    if (visibleTimes.length >= MAX_DAILY_SCHEDULE_TIMES) {
      return
    }
    setTimes([...visibleTimes, '09:00'])
  }

  function removeTime(index: number) {
    const next = visibleTimes.filter((_, i) => i !== index)
    setTimes(next.length > 0 ? next : ['09:00'])
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm" htmlFor={`${id}-0`}>
        Times of day
      </Label>
      <div className="grid gap-2">
        {rows.map((row, index) => (
          <div className="flex items-center gap-2" key={row.key}>
            <Input
              id={`${id}-${index}`}
              max="23:59"
              min="00:00"
              onChange={(event) => updateTime(index, event.target.value)}
              type="time"
              value={row.time}
            />
            <Button
              aria-label="Remove schedule time"
              disabled={visibleTimes.length === 1}
              onClick={() => removeTime(index)}
              size="icon"
              type="button"
              variant="outline"
            >
              <X aria-hidden className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        className="self-start"
        disabled={visibleTimes.length >= MAX_DAILY_SCHEDULE_TIMES}
        onClick={addTime}
        type="button"
        variant="outline"
      >
        <Plus aria-hidden className="mr-2 size-4" />
        Add time
      </Button>
      <p className="text-muted-foreground text-xs">
        Times use your account timezone (
        <span className="font-mono">{timezoneLabel}</span>) and run on the first
        cron tick after the selected time.
      </p>
    </div>
  )
}

function scheduleTimeRows(id: string, times: readonly string[]) {
  const counts = new Map<string, number>()
  return times.map((time) => {
    const count = (counts.get(time) ?? 0) + 1
    counts.set(time, count)
    return {
      key: `${id}-${time}-${count}`,
      time,
    }
  })
}
