import { describe, expect, it } from 'vitest'
import {
  assertAgentVisibleSandboxPath,
  assertWritableSandboxPath,
  isRuntimeOwnedPath,
  normalizeSandboxPath,
  SandboxPathError,
} from './paths'

describe('sandbox path guards', () => {
  it('blocks runtime-owned dreaming store paths', () => {
    expect(isRuntimeOwnedPath('memory/.dreams/dreaming.sqlite')).toBe(true)
    expect(() =>
      assertWritableSandboxPath(
        normalizeSandboxPath('memory/.dreams/dreaming.sqlite')
      )
    ).toThrow(SandboxPathError)
    expect(() =>
      assertAgentVisibleSandboxPath(
        normalizeSandboxPath('memory/.dreams/dreaming.sqlite')
      )
    ).toThrow(SandboxPathError)
  })
})
