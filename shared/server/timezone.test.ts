import assert from 'node:assert/strict'
import test from 'node:test'
import { localDateTimeParts, localDateTimeToUtc } from './timezone'

test('localDateTimeParts formats local date and time in timezone', () => {
  const parts = localDateTimeParts(
    new Date('2026-05-14T16:03:00.000Z'),
    'Europe/Rome'
  )
  assert.equal(parts.date, '2026-05-14')
  assert.equal(parts.time, '18:03')
})

test('localDateTimeToUtc converts a valid local slot to UTC', () => {
  const utc = localDateTimeToUtc({
    localDate: '2026-05-14',
    time: '09:00',
    timezone: 'Europe/Rome',
  })
  assert.equal(utc?.toISOString(), '2026-05-14T07:00:00.000Z')
})

test('localDateTimeToUtc falls back to UTC for invalid timezone', () => {
  const utc = localDateTimeToUtc({
    localDate: '2026-05-14',
    time: '09:00',
    timezone: 'Not/A_Zone',
  })
  assert.equal(utc?.toISOString(), '2026-05-14T09:00:00.000Z')
})
