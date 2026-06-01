import type { AgentScheduleMode } from '@outname/shared/agent-schedule'
import { Label } from '@outname/ui/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@outname/ui/components/ui/select'
import { HeartbeatDailyTimesEditor } from './heartbeat-daily-times-editor'
import { HeartbeatIntervalSelect } from './heartbeat-interval-select'

export function HeartbeatScheduleControls({
  intervalHelpText,
  intervalId,
  intervalLabel,
  intervalMinutes,
  mode,
  setIntervalMinutes,
  setMode,
  setTimes,
  times,
  timesId,
  timezoneLabel,
}: {
  intervalHelpText: string
  intervalId: string
  intervalLabel: string
  intervalMinutes: number
  mode: AgentScheduleMode
  setIntervalMinutes: (value: number) => void
  setMode: (value: AgentScheduleMode) => void
  setTimes: (value: string[]) => void
  times: string[]
  timesId: string
  timezoneLabel: string
}) {
  function changeMode(value: AgentScheduleMode) {
    setMode(value)
    if (value === 'daily_times' && times.length === 0) {
      setTimes(['09:00'])
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2">
        <Label className="text-sm" htmlFor={`${timesId}-mode`}>
          Schedule mode
        </Label>
        <Select
          onValueChange={(value) => changeMode(value as AgentScheduleMode)}
          value={mode}
        >
          <SelectTrigger id={`${timesId}-mode`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="interval">Interval</SelectItem>
            <SelectItem value="daily_times">Times of day</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === 'daily_times' ? (
        <HeartbeatDailyTimesEditor
          id={timesId}
          setTimes={setTimes}
          times={times}
          timezoneLabel={timezoneLabel}
        />
      ) : (
        <HeartbeatIntervalSelect
          helpText={intervalHelpText}
          id={intervalId}
          label={intervalLabel}
          setValue={setIntervalMinutes}
          value={intervalMinutes}
        />
      )}
    </div>
  )
}
