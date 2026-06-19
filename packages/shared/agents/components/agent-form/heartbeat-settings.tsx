import type { AgentScheduleMode } from '@outname/shared/agent-schedule'
import { Label } from '@outname/ui/components/ui/label'
import { Switch } from '@outname/ui/components/ui/switch'
import { HeartbeatScheduleControls } from './heartbeat-schedule-controls'

export function HeartbeatSettings({
  heartbeatEnabled,
  intervalMinutes,
  scheduleMode,
  scheduleTimes,
  setHeartbeatEnabled,
  setIntervalMinutes,
  setScheduleMode,
  setScheduleTimes,
  timezoneLabel,
}: {
  heartbeatEnabled: boolean
  intervalMinutes: number
  scheduleMode: AgentScheduleMode
  scheduleTimes: string[]
  setHeartbeatEnabled: (value: boolean) => void
  setIntervalMinutes: (value: number) => void
  setScheduleMode: (value: AgentScheduleMode) => void
  setScheduleTimes: (value: string[]) => void
  timezoneLabel: string
}) {
  return (
    <div className="swiss-diagonal grid gap-4 border border-border bg-muted p-5 md:grid-cols-[12rem_minmax(0,1fr)]">
      <Label className="font-bold text-sm" htmlFor="agent-heartbeat">
        Heartbeat
      </Label>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-xs">
            When on, the agent wakes on a fixed cadence to do proactive work.
            Off means it only runs when you chat or click Trigger.
          </p>
          <Switch
            checked={heartbeatEnabled}
            id="agent-heartbeat"
            onCheckedChange={setHeartbeatEnabled}
          />
        </div>
        {heartbeatEnabled ? (
          <HeartbeatScheduleControls
            intervalHelpText="Heartbeat runs when this interval has elapsed since the last completed heartbeat."
            intervalId="agent-interval"
            intervalLabel="Interval"
            intervalMinutes={intervalMinutes}
            mode={scheduleMode}
            setIntervalMinutes={setIntervalMinutes}
            setMode={setScheduleMode}
            setTimes={setScheduleTimes}
            times={scheduleTimes}
            timesId="agent-heartbeat-times"
            timezoneLabel={timezoneLabel}
          />
        ) : null}
      </div>
    </div>
  )
}
