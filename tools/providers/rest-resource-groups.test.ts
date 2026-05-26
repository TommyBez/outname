import { describe, expect, it } from 'vitest'
import { enforceGroupAccess } from './rest-resource-groups'

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
})
