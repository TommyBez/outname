import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  type AgentScheduleMode,
  MAX_DAILY_SCHEDULE_TIMES,
} from '@/shared/agent-schedule'
import { INTERVAL_OPTIONS, type StepLimitMode } from './options'

export function StepLimitSettings({
  setStepLimitCustom,
  setStepLimitMode,
  stepLimitCustom,
  stepLimitMode,
}: {
  setStepLimitCustom: (value: number) => void
  setStepLimitMode: (value: StepLimitMode) => void
  stepLimitCustom: number
  stepLimitMode: StepLimitMode
}) {
  return (
    <div className="grid gap-4 border-2 border-foreground bg-background p-5 md:grid-cols-[12rem_minmax(0,1fr)]">
      <Label
        className="font-bold text-sm uppercase tracking-[0.14em]"
        htmlFor="agent-step-limit-mode"
      >
        Step limit
      </Label>
      <div className="flex flex-col gap-2">
        <Select
          onValueChange={(v) => setStepLimitMode(v as StepLimitMode)}
          value={stepLimitMode}
        >
          <SelectTrigger id="agent-step-limit-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low (10)</SelectItem>
            <SelectItem value="medium">Medium (30)</SelectItem>
            <SelectItem value="high">High (50)</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
            <SelectItem value="grind">Grind (unlimited)</SelectItem>
          </SelectContent>
        </Select>
        {stepLimitMode === 'custom' ? (
          <Input
            id="agent-step-limit-custom"
            min={1}
            onChange={(e) =>
              setStepLimitCustom(Number.parseInt(e.target.value, 10) || 30)
            }
            type="number"
            value={stepLimitCustom}
          />
        ) : null}
      </div>
    </div>
  )
}

export function HeartbeatSettings({
  heartbeatEnabled,
  intervalMinutes,
  scheduleMode,
  scheduleTimes,
  setHeartbeatEnabled,
  setIntervalMinutes,
  setScheduleMode,
  setScheduleTimes,
}: {
  heartbeatEnabled: boolean
  intervalMinutes: number
  scheduleMode: AgentScheduleMode
  scheduleTimes: string[]
  setHeartbeatEnabled: (value: boolean) => void
  setIntervalMinutes: (value: number) => void
  setScheduleMode: (value: AgentScheduleMode) => void
  setScheduleTimes: (value: string[]) => void
}) {
  return (
    <div className="swiss-diagonal grid gap-4 border-2 border-foreground bg-muted p-5 md:grid-cols-[12rem_minmax(0,1fr)]">
      <Label
        className="font-bold text-sm uppercase tracking-[0.14em]"
        htmlFor="agent-heartbeat"
      >
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
          <ScheduleControls
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
          />
        ) : null}
      </div>
    </div>
  )
}

export function DreamingSettings({
  dreamingEnabled,
  setDreamingEnabled,
}: {
  dreamingEnabled: boolean
  setDreamingEnabled: (value: boolean) => void
}) {
  return (
    <div className="grid gap-4 border-2 border-foreground bg-background p-5 md:grid-cols-[12rem_minmax(0,1fr)]">
      <Label
        className="font-bold text-sm uppercase tracking-[0.14em]"
        htmlFor="agent-dreaming"
      >
        Dreaming
      </Label>
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-xs">
          When on, the agent reviews its logs, updates DREAMS.md, and proposes
          updates to goals or tasks once per day — the first cron tick of the
          day that hasn't run it yet.
        </p>
        <Switch
          checked={dreamingEnabled}
          id="agent-dreaming"
          onCheckedChange={setDreamingEnabled}
        />
      </div>
    </div>
  )
}

function ScheduleControls({
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
        <DailyTimesEditor id={timesId} setTimes={setTimes} times={times} />
      ) : (
        <IntervalSelect
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

function DailyTimesEditor({
  id,
  setTimes,
  times,
}: {
  id: string
  setTimes: (value: string[]) => void
  times: string[]
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
        Times use your account timezone and run on the first cron tick after the
        selected time.
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

function IntervalSelect({
  helpText,
  id,
  label,
  setValue,
  value,
}: {
  helpText?: string
  id: string
  label: string
  setValue: (value: number) => void
  value: number
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm" htmlFor={id}>
        {label}
      </Label>
      <Select
        onValueChange={(v) => setValue(Number.parseInt(v, 10))}
        value={String(value)}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INTERVAL_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helpText ? (
        <p className="text-muted-foreground text-xs">{helpText}</p>
      ) : null}
    </div>
  )
}
