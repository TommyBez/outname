import { expect, test } from 'vitest'
import {
  formatCompactDateTimeInTimeZone,
  formatScheduleTimezoneSuffix,
  safeAccountTimeZone,
} from './format-timezone'

test('safeAccountTimeZone falls back for invalid zones', () => {
  expect(safeAccountTimeZone('Europe/Rome')).toBe('Europe/Rome')
  expect(safeAccountTimeZone('Not/A_Zone')).toBe('UTC')
  expect(safeAccountTimeZone(null)).toBe('UTC')
})

test('formatCompactDateTimeInTimeZone uses account timezone', () => {
  const formatted = formatCompactDateTimeInTimeZone(
    '2026-05-14T16:03:00.000Z',
    'Europe/Rome'
  )
  expect(formatted).toContain('6:03')
})

test('formatScheduleTimezoneSuffix includes offset when available', () => {
  const suffix = formatScheduleTimezoneSuffix('Europe/Rome')
  expect(suffix.startsWith(' (')).toBe(true)
  expect(suffix.endsWith(')')).toBe(true)
})
