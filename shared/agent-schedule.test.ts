import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeDailyScheduleTimes,
  validateDailyScheduleTimes,
} from './agent-schedule'

test('daily schedule times are normalized, deduped, and sorted', () => {
  assert.deepEqual(normalizeDailyScheduleTimes(['17:00', '09:00', '09:00']), [
    '09:00',
    '17:00',
  ])
})

test('daily schedule validation rejects invalid time formats', () => {
  assert.throws(() => validateDailyScheduleTimes(['9:00']))
  assert.throws(() => validateDailyScheduleTimes(['24:00']))
})

test('daily schedule validation requires at least one normalized time', () => {
  assert.throws(() => validateDailyScheduleTimes([]))
})

test('daily schedule validation allows at most eight unique times', () => {
  assert.throws(() =>
    validateDailyScheduleTimes([
      '00:00',
      '01:00',
      '02:00',
      '03:00',
      '04:00',
      '05:00',
      '06:00',
      '07:00',
      '08:00',
    ])
  )
})
