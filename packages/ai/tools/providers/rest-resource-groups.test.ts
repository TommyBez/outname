import { describe, expect, it } from 'vitest'
import {
  buildResourceConfigShape,
  enforceGroupAccess,
  enforceResourceAccess,
  resourceConfigFieldName,
} from './rest-resource-groups'

describe('enforceGroupAccess', () => {
  it('allows safe methods in read-only mode regardless of case', () => {
    expect(
      enforceGroupAccess({
        enabled: true,
        globalReadOnly: true,
        group: 'Projects',
        method: 'get',
        readOnly: false,
      })
    ).toEqual({ ok: true })

    expect(
      enforceGroupAccess({
        enabled: true,
        globalReadOnly: false,
        group: 'Projects',
        method: 'head',
        readOnly: true,
      })
    ).toEqual({ ok: true })

    expect(
      enforceGroupAccess({
        enabled: true,
        globalReadOnly: false,
        group: 'Projects',
        method: 'options',
        readOnly: true,
      })
    ).toEqual({ ok: true })
  })

  it('still blocks mutating methods in read-only mode', () => {
    expect(
      enforceGroupAccess({
        enabled: true,
        globalReadOnly: false,
        group: 'Projects',
        method: 'post',
        readOnly: true,
      })
    ).toEqual({
      message: 'This attachment blocks mutating projects operations.',
      ok: false,
    })
  })

  it('generates stable config field names and shapes per resource', () => {
    const resource = { key: 'feature_flags', label: 'Feature Flags' } as const

    expect(resourceConfigFieldName({ kind: 'enable', resource })).toBe(
      'enableGroupFeatureFlags'
    )
    expect(resourceConfigFieldName({ kind: 'readOnly', resource })).toBe(
      'readOnlyGroupFeatureFlags'
    )

    expect(Object.keys(buildResourceConfigShape([resource]))).toEqual([
      'enableGroupFeatureFlags',
      'readOnlyGroupFeatureFlags',
    ])
  })

  it('reads generated config fields when enforcing resource access', () => {
    const resource = {
      defaultReadOnly: true,
      key: 'feature_flags',
      label: 'Feature Flags',
    } as const

    expect(
      enforceResourceAccess({
        config: {
          enableGroupFeatureFlags: true,
          readOnlyGroupFeatureFlags: false,
        },
        globalReadOnly: false,
        method: 'POST',
        resource,
      })
    ).toEqual({ ok: true })
  })
})
