import { expect, test } from 'vitest'
import {
  normalizeDailyScheduleTimes,
  validateDailyScheduleTimes,
} from './agent-schedule'

test('daily schedule times are normalized, deduped, and sorted', () => {
  expect(normalizeDailyScheduleTimes(['17:00', '09:00', '09:00'])).toEqual([
    '09:00',
    '17:00',
  ])
})

test('daily schedule validation rejects invalid time formats', () => {
  expect(() => validateDailyScheduleTimes(['9:00'])).toThrow()
  expect(() => validateDailyScheduleTimes(['24:00'])).toThrow()
})

test('daily schedule validation requires at least one normalized time', () => {
  expect(() => validateDailyScheduleTimes([])).toThrow()
})

test('daily schedule validation allows at most eight unique times', () => {
  expect(() =>
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
  ).toThrow()
})
