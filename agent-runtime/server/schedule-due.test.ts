import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveDailyScheduleDue } from './schedule-due'

test('daily schedule waits until the first local slot is due', () => {
  const due = resolveDailyScheduleDue({
    lastRunAt: null,
    now: new Date('2026-05-14T06:59:00.000Z'),
    times: ['09:00'],
    timezone: 'Europe/Rome',
  })
  assert.equal(due, null)
})

test('daily schedule maps local time to scheduled UTC instant', () => {
  const due = resolveDailyScheduleDue({
    lastRunAt: null,
    now: new Date('2026-05-14T07:01:00.000Z'),
    times: ['09:00'],
    timezone: 'Europe/Rome',
  })
  assert.equal(due?.localDate, '2026-05-14')
  assert.equal(due?.time, '09:00')
  assert.equal(due?.scheduledFor.toISOString(), '2026-05-14T07:00:00.000Z')
})

test('daily schedule catches only the latest missed slot for today', () => {
  const due = resolveDailyScheduleDue({
    lastRunAt: null,
    now: new Date('2026-05-14T16:00:00.000Z'),
    times: ['09:00', '17:00'],
    timezone: 'Europe/Rome',
  })
  assert.equal(due?.time, '17:00')
  assert.equal(due?.scheduledFor.toISOString(), '2026-05-14T15:00:00.000Z')
})

test('daily schedule does not repeat a slot already covered by last run', () => {
  const due = resolveDailyScheduleDue({
    lastRunAt: new Date('2026-05-14T15:01:00.000Z'),
    now: new Date('2026-05-14T16:00:00.000Z'),
    times: ['09:00', '17:00'],
    timezone: 'Europe/Rome',
  })
  assert.equal(due, null)
})
