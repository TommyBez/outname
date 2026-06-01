import type { ToolConfigField } from './types'

export type BooleanFieldRole = 'enable' | 'readonly' | 'generic'

export interface GroupConfigSection {
  enable?: ToolConfigField
  readOnly?: ToolConfigField
  section: string
}

export function booleanRoleFromField(field: ToolConfigField): BooleanFieldRole {
  if (field.name.startsWith('enableGroup') || field.label === 'Enabled') {
    return 'enable'
  }
  if (
    field.name.startsWith('readOnlyGroup') ||
    field.name === 'readOnly' ||
    field.label === 'Read Only'
  ) {
    return 'readonly'
  }
  return 'generic'
}

export function partitionConfigFields(fields: ToolConfigField[]): {
  generalFields: ToolConfigField[]
  globalReadOnlyField?: ToolConfigField
  groupSections: GroupConfigSection[]
} {
  const generalFields: ToolConfigField[] = []
  const groupSections = new Map<string, GroupConfigSection>()
  let globalReadOnlyField: ToolConfigField | undefined

  for (const field of fields) {
    if (field.section && field.name.startsWith('enableGroup')) {
      const current = groupSections.get(field.section) ?? {
        section: field.section,
      }
      current.enable = field
      groupSections.set(field.section, current)
      continue
    }
    if (field.section && field.name.startsWith('readOnlyGroup')) {
      const current = groupSections.get(field.section) ?? {
        section: field.section,
      }
      current.readOnly = field
      groupSections.set(field.section, current)
      continue
    }
    generalFields.push(field)
  }

  const groupedSections = Array.from(groupSections.values())
  if (groupedSections.length > 0) {
    const readOnlyIndex = generalFields.findIndex(
      (field) => field.name === 'readOnly' && field.type === 'boolean'
    )
    if (readOnlyIndex >= 0) {
      globalReadOnlyField = generalFields[readOnlyIndex]
      generalFields.splice(readOnlyIndex, 1)
    }
  }

  return {
    generalFields,
    globalReadOnlyField,
    groupSections: groupedSections,
  }
}

export function readBooleanValue(
  values: Record<string, string>,
  field: ToolConfigField | undefined,
  fallback = false
): boolean {
  if (!field) {
    return fallback
  }
  const raw = values[field.name]
  if (raw === 'true') {
    return true
  }
  if (raw === 'false') {
    return false
  }
  if (field.defaultValue === true) {
    return true
  }
  if (field.defaultValue === false) {
    return false
  }
  return fallback
}

export function allGroupFieldsMatch(
  groupSections: GroupConfigSection[],
  values: Record<string, string>,
  kind: 'enable' | 'readOnly',
  expected: boolean
): boolean {
  const fields = groupSections
    .map((group) => (kind === 'enable' ? group.enable : group.readOnly))
    .filter((field): field is ToolConfigField => field !== undefined)

  if (fields.length === 0) {
    return false
  }

  return fields.every(
    (field) =>
      readBooleanValue(values, field, field.defaultValue === true) === expected
  )
}

export function patchGroupBooleanValues(
  values: Record<string, string>,
  groupSections: GroupConfigSection[],
  kind: 'enable' | 'readOnly',
  nextValue: boolean
): Record<string, string> {
  const next = { ...values }
  for (const group of groupSections) {
    const field = kind === 'enable' ? group.enable : group.readOnly
    if (field) {
      next[field.name] = String(nextValue)
    }
  }
  return next
}

export function allWriteAccessMatches(
  values: Record<string, string>,
  groupSections: GroupConfigSection[],
  globalReadOnlyField: ToolConfigField | undefined,
  expected: boolean
): boolean {
  if (globalReadOnlyField) {
    const globalValue = readBooleanValue(
      values,
      globalReadOnlyField,
      globalReadOnlyField.defaultValue === true
    )
    if (globalValue !== expected) {
      return false
    }
  }
  return allGroupFieldsMatch(groupSections, values, 'readOnly', expected)
}

export function patchAllWriteAccess(
  values: Record<string, string>,
  groupSections: GroupConfigSection[],
  globalReadOnlyField: ToolConfigField | undefined,
  nextValue: boolean
): Record<string, string> {
  let next = patchGroupBooleanValues(
    values,
    groupSections,
    'readOnly',
    nextValue
  )
  if (globalReadOnlyField) {
    next = {
      ...next,
      [globalReadOnlyField.name]: String(nextValue),
    }
  }
  return next
}
