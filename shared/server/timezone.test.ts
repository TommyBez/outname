import { expect, test } from 'vitest'
import { localDateTimeParts, localDateTimeToUtc } from './timezone'

test('localDateTimeParts formats local date and time in timezone', () => {
  const parts = localDateTimeParts(
    new Date('2026-05-14T16:03:00.000Z'),
    'Europe/Rome'
  )
  expect(parts.date).toBe('2026-05-14')
  expect(parts.time).toBe('18:03')
})

test('localDateTimeToUtc converts a valid local slot to UTC', () => {
  const utc = localDateTimeToUtc({
    localDate: '2026-05-14',
    time: '09:00',
    timezone: 'Europe/Rome',
  })
  expect(utc?.toISOString()).toBe('2026-05-14T07:00:00.000Z')
})

test('localDateTimeToUtc falls back to UTC for invalid timezone', () => {
  const utc = localDateTimeToUtc({
    localDate: '2026-05-14',
    time: '09:00',
    timezone: 'Not/A_Zone',
  })
  expect(utc?.toISOString()).toBe('2026-05-14T09:00:00.000Z')
})
