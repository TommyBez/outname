import { Label } from '@outname/ui/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@outname/ui/components/ui/select'
import { INTERVAL_OPTIONS } from './options'

export function HeartbeatIntervalSelect({
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
