import { Input } from '@outname/ui/components/ui/input'
import { Label } from '@outname/ui/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@outname/ui/components/ui/select'
import type { StepLimitMode } from './options'

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
    <div className="grid gap-4 border border-border bg-background p-5 md:grid-cols-[12rem_minmax(0,1fr)]">
      <Label className="font-bold text-sm" htmlFor="agent-step-limit-mode">
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
