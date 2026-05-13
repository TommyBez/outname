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
  setHeartbeatEnabled,
  setIntervalMinutes,
}: {
  heartbeatEnabled: boolean
  intervalMinutes: number
  setHeartbeatEnabled: (value: boolean) => void
  setIntervalMinutes: (value: number) => void
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
          <IntervalSelect
            helpText="Dreaming runs at most once per N minutes, and at least once per local day."
            id="agent-interval"
            label="Interval"
            setValue={setIntervalMinutes}
            value={intervalMinutes}
          />
        ) : null}
      </div>
    </div>
  )
}

export function DreamingSettings({
  dreamingEnabled,
  dreamingIntervalMinutes,
  setDreamingEnabled,
  setDreamingIntervalMinutes,
}: {
  dreamingEnabled: boolean
  dreamingIntervalMinutes: number
  setDreamingEnabled: (value: boolean) => void
  setDreamingIntervalMinutes: (value: number) => void
}) {
  return (
    <div className="grid gap-4 border-2 border-foreground bg-background p-5 md:grid-cols-[12rem_minmax(0,1fr)]">
      <Label
        className="font-bold text-sm uppercase tracking-[0.14em]"
        htmlFor="agent-dreaming"
      >
        Dreaming
      </Label>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-xs">
            When on, the agent periodically reviews its logs, updates DREAMS.md,
            and proposes updates to goals or tasks. This can run even when
            heartbeat is off.
          </p>
          <Switch
            checked={dreamingEnabled}
            id="agent-dreaming"
            onCheckedChange={setDreamingEnabled}
          />
        </div>
        {dreamingEnabled ? (
          <IntervalSelect
            id="agent-dreaming-interval"
            label="Dreaming cadence"
            setValue={setDreamingIntervalMinutes}
            value={dreamingIntervalMinutes}
          />
        ) : null}
      </div>
    </div>
  )
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
