import { expect, test } from 'vitest'
import {
  isValidIanaTimeZone,
  localDateTimeParts,
  localDateTimeToUtc,
  normalizeUserTimeZone,
} from './timezone'

test('isValidIanaTimeZone accepts IANA ids and rejects invalid values', () => {
  expect(isValidIanaTimeZone('Europe/Rome')).toBe(true)
  expect(isValidIanaTimeZone('Not/A_Zone')).toBe(false)
  expect(isValidIanaTimeZone('')).toBe(false)
})

test('normalizeUserTimeZone trims and validates', () => {
  expect(normalizeUserTimeZone(' Europe/Rome ')).toBe('Europe/Rome')
  expect(normalizeUserTimeZone('bad')).toBeNull()
})

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
