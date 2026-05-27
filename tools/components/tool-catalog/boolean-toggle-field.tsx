'use client'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { BooleanFieldRole } from './config-field-utils'

const TOGGLE_GROUP_CLASS =
  'rounded-none border-2 border-foreground data-[variant=outline]:shadow-none'

const TOGGLE_ITEM_CLASS =
  'rounded-none font-bold text-[10px] uppercase tracking-[0.16em] data-[state=on]:bg-foreground data-[state=on]:text-background'

export function BooleanToggleField({
  ariaLabel,
  className,
  disabled,
  falseLabel,
  fieldRole,
  id,
  mixed,
  onChange,
  trueLabel,
  value,
}: {
  ariaLabel: string
  className?: string
  disabled?: boolean
  falseLabel?: string
  fieldRole: BooleanFieldRole
  id?: string
  mixed?: boolean
  onChange: (value: boolean) => void
  trueLabel?: string
  value: boolean
}) {
  const labels = labelsForRole(fieldRole)

  return (
    <ToggleGroup
      aria-label={ariaLabel}
      className={cn(TOGGLE_GROUP_CLASS, className)}
      disabled={disabled}
      id={id}
      onValueChange={(next) => {
        if (next === 'true' || next === 'false') {
          onChange(next === 'true')
        }
      }}
      type="single"
      value={toggleGroupValue(mixed, value)}
      variant="outline"
    >
      <ToggleGroupItem className={TOGGLE_ITEM_CLASS} value="false">
        {falseLabel ?? labels.falseLabel}
      </ToggleGroupItem>
      <ToggleGroupItem className={TOGGLE_ITEM_CLASS} value="true">
        {trueLabel ?? labels.trueLabel}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

function toggleGroupValue(mixed: boolean | undefined, value: boolean): string {
  if (mixed) {
    return ''
  }
  return value ? 'true' : 'false'
}

function labelsForRole(role: BooleanFieldRole): {
  falseLabel: string
  trueLabel: string
} {
  if (role === 'enable') {
    return { falseLabel: 'Disabled', trueLabel: 'Enabled' }
  }
  if (role === 'readonly') {
    return { falseLabel: 'Writable', trueLabel: 'Read-only' }
  }
  return { falseLabel: 'Off', trueLabel: 'On' }
}
