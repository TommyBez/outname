import { describe, expect, test } from 'vitest'
import {
  allGroupFieldsMatch,
  allWriteAccessMatches,
  booleanRoleFromField,
  partitionConfigFields,
  patchAllWriteAccess,
  patchGroupBooleanValues,
  readBooleanValue,
} from './config-field-utils'
import type { ToolConfigField } from './types'

const enableField: ToolConfigField = {
  defaultValue: true,
  description: 'Enable project endpoints.',
  label: 'Enabled',
  name: 'enableGroupProjects',
  required: false,
  section: 'Projects',
  type: 'boolean',
}

const readOnlyField: ToolConfigField = {
  defaultValue: true,
  description: 'When true, project endpoints are read-only.',
  label: 'Read Only',
  name: 'readOnlyGroupProjects',
  required: false,
  section: 'Projects',
  type: 'boolean',
}

describe('partitionConfigFields', () => {
  test('splits grouped toggles from general fields', () => {
    const regionField: ToolConfigField = {
      label: 'Region',
      name: 'region',
      required: true,
      type: 'text',
    }

    const globalReadOnly: ToolConfigField = {
      defaultValue: true,
      description: 'When true, only GET requests are allowed across groups.',
      label: 'Read Only',
      name: 'readOnly',
      required: false,
      type: 'boolean',
    }

    expect(
      partitionConfigFields([
        regionField,
        globalReadOnly,
        enableField,
        readOnlyField,
      ])
    ).toEqual({
      generalFields: [regionField],
      globalReadOnlyField: globalReadOnly,
      groupSections: [
        {
          section: 'Projects',
          enable: enableField,
          readOnly: readOnlyField,
        },
      ],
    })
  })

  test('keeps global readOnly in general fields when there are no groups', () => {
    const globalReadOnly: ToolConfigField = {
      label: 'Read Only',
      name: 'readOnly',
      required: false,
      type: 'boolean',
    }

    expect(partitionConfigFields([globalReadOnly])).toEqual({
      generalFields: [globalReadOnly],
      globalReadOnlyField: undefined,
      groupSections: [],
    })
  })
})

describe('booleanRoleFromField', () => {
  test('maps enable and read-only field names', () => {
    expect(booleanRoleFromField(enableField)).toBe('enable')
    expect(booleanRoleFromField(readOnlyField)).toBe('readonly')
    expect(
      booleanRoleFromField({
        label: 'Read Only',
        name: 'readOnly',
        required: false,
        type: 'boolean',
      })
    ).toBe('readonly')
  })
})

describe('group bulk helpers', () => {
  test('patches all group enable values', () => {
    const groupSections = partitionConfigFields([
      enableField,
      readOnlyField,
    ]).groupSections

    expect(
      patchGroupBooleanValues(
        { enableGroupProjects: 'false', readOnlyGroupProjects: 'true' },
        groupSections,
        'enable',
        true
      )
    ).toEqual({
      enableGroupProjects: 'true',
      readOnlyGroupProjects: 'true',
    })
  })

  test('detects when all group fields share the same value', () => {
    const groupSections = partitionConfigFields([
      enableField,
      readOnlyField,
    ]).groupSections

    expect(
      allGroupFieldsMatch(
        groupSections,
        { enableGroupProjects: 'true', readOnlyGroupProjects: 'true' },
        'enable',
        true
      )
    ).toBe(true)
    expect(
      allGroupFieldsMatch(
        groupSections,
        { enableGroupProjects: 'false', readOnlyGroupProjects: 'true' },
        'enable',
        true
      )
    ).toBe(false)
  })

  test('reads boolean values with defaults', () => {
    expect(readBooleanValue({}, enableField, true)).toBe(true)
    expect(
      readBooleanValue({ enableGroupProjects: 'false' }, enableField)
    ).toBe(false)
  })
})

describe('write access bulk helpers', () => {
  const globalReadOnly: ToolConfigField = {
    defaultValue: true,
    label: 'Read Only',
    name: 'readOnly',
    required: false,
    type: 'boolean',
  }

  test('patches global readOnly and every group readOnly field', () => {
    const groupSections = partitionConfigFields([
      enableField,
      readOnlyField,
    ]).groupSections

    expect(
      patchAllWriteAccess(
        { readOnly: 'false', readOnlyGroupProjects: 'false' },
        groupSections,
        globalReadOnly,
        true
      )
    ).toEqual({
      readOnly: 'true',
      readOnlyGroupProjects: 'true',
    })
  })

  test('matches write access only when global and all groups agree', () => {
    const groupSections = partitionConfigFields([
      enableField,
      readOnlyField,
    ]).groupSections

    expect(
      allWriteAccessMatches(
        { readOnly: 'true', readOnlyGroupProjects: 'true' },
        groupSections,
        globalReadOnly,
        true
      )
    ).toBe(true)
    expect(
      allWriteAccessMatches(
        { readOnly: 'true', readOnlyGroupProjects: 'false' },
        groupSections,
        globalReadOnly,
        true
      )
    ).toBe(false)
  })
})
