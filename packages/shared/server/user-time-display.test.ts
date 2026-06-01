import { createUserTimeDisplay } from '@outname/shared/user-time-display'
import { expect, test } from 'vitest'

test('createUserTimeDisplay formats schedule and timestamps in account timezone', () => {
  const display = createUserTimeDisplay('Europe/Rome')

  expect(display.timeZone).toBe('Europe/Rome')
  expect(display.timezoneLabel).toContain('Europe/Rome')
  expect(
    display.agentSchedule({
      enabled: true,
      intervalMinutes: 30,
      mode: 'daily_times',
      times: ['09:00'],
    })
  ).toContain('09:00')
  expect(display.mediumDateTime('2026-05-14T16:03:00.000Z')).toContain('6:03')
})
