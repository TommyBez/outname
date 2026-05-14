import { expect, test } from 'vitest'
import { resolveDailyScheduleDue } from './schedule-due'

test('daily schedule waits until the first local slot is due', () => {
  const due = resolveDailyScheduleDue({
    lastRunAt: null,
    now: new Date('2026-05-14T06:59:00.000Z'),
    times: ['09:00'],
    timezone: 'Europe/Rome',
  })
  expect(due).toBeNull()
})

test('daily schedule maps local time to scheduled UTC instant', () => {
  const due = resolveDailyScheduleDue({
    lastRunAt: null,
    now: new Date('2026-05-14T07:01:00.000Z'),
    times: ['09:00'],
    timezone: 'Europe/Rome',
  })
  expect(due?.localDate).toBe('2026-05-14')
  expect(due?.time).toBe('09:00')
  expect(due?.scheduledFor.toISOString()).toBe('2026-05-14T07:00:00.000Z')
})

test('daily schedule catches only the latest missed slot for today', () => {
  const due = resolveDailyScheduleDue({
    lastRunAt: null,
    now: new Date('2026-05-14T16:00:00.000Z'),
    times: ['09:00', '17:00'],
    timezone: 'Europe/Rome',
  })
  expect(due?.time).toBe('17:00')
  expect(due?.scheduledFor.toISOString()).toBe('2026-05-14T15:00:00.000Z')
})

test('daily schedule does not repeat a slot already covered by last run', () => {
  const due = resolveDailyScheduleDue({
    lastRunAt: new Date('2026-05-14T15:01:00.000Z'),
    now: new Date('2026-05-14T16:00:00.000Z'),
    times: ['09:00', '17:00'],
    timezone: 'Europe/Rome',
  })
  expect(due).toBeNull()
})
