'use client'

import { BooleanToggleField } from './boolean-toggle-field'
import {
  allGroupFieldsMatch,
  allWriteAccessMatches,
  booleanRoleFromField,
  type GroupConfigSection,
  patchAllWriteAccess,
  patchGroupBooleanValues,
  readBooleanValue,
} from './config-field-utils'
import type { ToolConfigField } from './types'

export function GroupConfigPanel({
  disabled,
  globalReadOnlyField,
  groupSections,
  onChange,
  values,
}: {
  disabled?: boolean
  globalReadOnlyField?: ToolConfigField
  groupSections: GroupConfigSection[]
  onChange: (values: Record<string, string>) => void
  values: Record<string, string>
}) {
  if (groupSections.length === 0) {
    return null
  }

  const allEnabled = allGroupFieldsMatch(groupSections, values, 'enable', true)
  const allDisabled = allGroupFieldsMatch(
    groupSections,
    values,
    'enable',
    false
  )
  const allReadOnly = allWriteAccessMatches(
    values,
    groupSections,
    globalReadOnlyField,
    true
  )
  const allWritable = allWriteAccessMatches(
    values,
    groupSections,
    globalReadOnlyField,
    false
  )
  const hasEnableFields = groupSections.some(
    (group) => group.enable !== undefined
  )
  const hasReadOnlyFields =
    globalReadOnlyField !== undefined ||
    groupSections.some((group) => group.readOnly !== undefined)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 border border-border bg-background p-3">
        <p className="font-black font-mono text-xs uppercase tracking-[0.08em]">
          Resource groups
        </p>
        {(hasEnableFields || hasReadOnlyFields) && (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            {hasEnableFields ? (
              <BulkToggleControl
                disabled={disabled}
                falseActive={allDisabled}
                falseLabel="Disable all"
                fieldRole="enable"
                label="Enabled"
                onSelect={(nextValue) =>
                  onChange(
                    patchGroupBooleanValues(
                      values,
                      groupSections,
                      'enable',
                      nextValue
                    )
                  )
                }
                trueActive={allEnabled}
                trueLabel="Enable all"
              />
            ) : null}
            {hasReadOnlyFields ? (
              <BulkToggleControl
                disabled={disabled}
                falseActive={allWritable}
                falseLabel="Writable all"
                fieldRole="readonly"
                label="Access"
                onSelect={(nextValue) =>
                  onChange(
                    patchAllWriteAccess(
                      values,
                      groupSections,
                      globalReadOnlyField,
                      nextValue
                    )
                  )
                }
                trueActive={allReadOnly}
                trueLabel="Read-only all"
              />
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="hidden gap-3 px-1 font-bold text-[10px] uppercase tracking-[0.2em] sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <span>Group</span>
          <span>Enabled</span>
          <span>Access</span>
        </div>
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto border border-border bg-background p-2">
          {groupSections.map((group) => (
            <GroupConfigRow
              disabled={disabled}
              group={group}
              key={group.section}
              onFieldChange={(fieldName, nextValue) =>
                onChange({
                  ...values,
                  [fieldName]: String(nextValue),
                })
              }
              values={values}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function BulkToggleControl({
  disabled,
  falseActive,
  falseLabel,
  fieldRole,
  label,
  onSelect,
  trueActive,
  trueLabel,
}: {
  disabled?: boolean
  falseActive: boolean
  falseLabel: string
  fieldRole: 'enable' | 'readonly'
  label: string
  onSelect: (value: boolean) => void
  trueActive: boolean
  trueLabel: string
}) {
  const mixed = !(trueActive || falseActive)

  return (
    <div className="flex min-w-[12rem] flex-col gap-1">
      <span className="font-bold text-[10px] uppercase tracking-[0.2em]">
        {label}
      </span>
      <BooleanToggleField
        ariaLabel={label}
        disabled={disabled}
        falseLabel={falseLabel}
        fieldRole={fieldRole}
        mixed={mixed}
        onChange={onSelect}
        trueLabel={trueLabel}
        value={trueActive}
      />
    </div>
  )
}

function GroupConfigRow({
  disabled,
  group,
  onFieldChange,
  values,
}: {
  disabled?: boolean
  group: GroupConfigSection
  onFieldChange: (fieldName: string, value: boolean) => void
  values: Record<string, string>
}) {
  return (
    <div className="grid gap-3 border border-border/20 p-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
      <div className="min-w-0">
        <p className="font-black font-mono text-xs uppercase tracking-[0.08em]">
          {group.section}
        </p>
        {(group.enable?.description || group.readOnly?.description) && (
          <p className="mt-1 text-muted-foreground text-xs">
            {group.enable?.description ?? group.readOnly?.description}
          </p>
        )}
      </div>
      {group.enable ? (
        <BooleanToggleField
          ariaLabel={`${group.section} enabled`}
          disabled={disabled}
          fieldRole={booleanRoleFromField(group.enable)}
          onChange={(nextValue) =>
            onFieldChange(group.enable?.name ?? '', nextValue)
          }
          value={readBooleanValue(values, group.enable, true)}
        />
      ) : (
        <span />
      )}
      {group.readOnly ? (
        <BooleanToggleField
          ariaLabel={`${group.section} read-only`}
          disabled={disabled}
          fieldRole={booleanRoleFromField(group.readOnly)}
          onChange={(nextValue) =>
            onFieldChange(group.readOnly?.name ?? '', nextValue)
          }
          value={readBooleanValue(
            values,
            group.readOnly,
            group.readOnly.defaultValue === true
          )}
        />
      ) : (
        <span />
      )}
    </div>
  )
}
