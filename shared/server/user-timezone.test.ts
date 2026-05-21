import { expect, test } from 'vitest'
import { DEFAULT_TIMEZONE } from './timezone'

// Mirrors getUserTimezoneBootstrapState allowAutoSync logic for quick regression checks.
function resolveAllowAutoSync(input: {
  timezone: string
  timezoneConfiguredAt: Date | null
}): boolean {
  return (
    input.timezone === DEFAULT_TIMEZONE && input.timezoneConfiguredAt == null
  )
}

test('allowAutoSync only for default UTC accounts without configured timestamp', () => {
  expect(
    resolveAllowAutoSync({
      timezone: 'UTC',
      timezoneConfiguredAt: null,
    })
  ).toBe(true)
  expect(
    resolveAllowAutoSync({
      timezone: 'UTC',
      timezoneConfiguredAt: new Date(),
    })
  ).toBe(false)
  expect(
    resolveAllowAutoSync({
      timezone: 'Europe/Rome',
      timezoneConfiguredAt: null,
    })
  ).toBe(false)
})
