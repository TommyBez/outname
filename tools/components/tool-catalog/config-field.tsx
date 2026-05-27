'use client'

import { useEffect } from 'react'
import { BooleanToggleField } from './boolean-toggle-field'
import { booleanRoleFromField, readBooleanValue } from './config-field-utils'
import type { ToolConfigField } from './types'

export function ConfigField({
  field,
  onChange,
  toolId,
  value,
}: {
  field: ToolConfigField
  onChange: (value: string) => void
  toolId: string
  value: string
}) {
  const inputId = `tool-${toolId}-${field.name}`
  const booleanValue = readBooleanValue({ [field.name]: value }, field, false)

  useEffect(() => {
    if (field.type !== 'boolean') {
      return
    }
    if (value === '' && field.defaultValue === true) {
      onChange('true')
    }
  }, [field.defaultValue, field.type, onChange, value])

  return (
    <div className="flex flex-col gap-1">
      <label
        className="font-bold text-[10px] uppercase tracking-[0.2em]"
        htmlFor={inputId}
      >
        {field.label}
        {field.required && <span className="ml-1 text-destructive">*</span>}
      </label>
      {field.description && (
        <span className="text-muted-foreground text-xs">
          {field.description}
        </span>
      )}
      {field.type === 'boolean' ? (
        <BooleanToggleField
          ariaLabel={field.label}
          fieldRole={booleanRoleFromField(field)}
          id={inputId}
          onChange={(nextValue) => onChange(String(nextValue))}
          value={booleanValue}
        />
      ) : (
        <input
          className="h-10 w-full border-2 border-foreground bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          id={inputId}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          type={inputTypeFor(field.type)}
          value={value}
        />
      )}
    </div>
  )
}

function inputTypeFor(
  type: ToolConfigField['type']
): 'number' | 'password' | 'text' {
  if (type === 'number') {
    return 'number'
  }
  if (type === 'password') {
    return 'password'
  }
  return 'text'
}
