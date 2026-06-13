import { expect, test } from 'vitest'
import {
  replyNamespaceForEvent,
  scheduledBucketKey,
  scheduledDailyKey,
} from './agent-event-keys'

test('scheduled event keys bucket heartbeat and dreaming independently', () => {
  const now = new Date('2026-05-14T09:07:12.000Z')
  const sameBucket = new Date('2026-05-14T09:09:59.999Z')
  const nextBucket = new Date('2026-05-14T09:10:00.000Z')

  const heartbeatKey = scheduledBucketKey({
    agentId: 'agent_123',
    intervalMinutes: 5,
    now,
    type: 'heartbeat',
  })

  expect(heartbeatKey).toBe(
    scheduledBucketKey({
      agentId: 'agent_123',
      intervalMinutes: 5,
      now: sameBucket,
      type: 'heartbeat',
    })
  )
  expect(heartbeatKey).not.toBe(
    scheduledBucketKey({
      agentId: 'agent_123',
      intervalMinutes: 5,
      now: nextBucket,
      type: 'heartbeat',
    })
  )
  expect(heartbeatKey).not.toBe(
    scheduledBucketKey({
      agentId: 'agent_123',
      intervalMinutes: 5,
      now,
      type: 'dreaming',
    })
  )
})

test('scheduled bucket and reply namespaces are stable', () => {
  expect(
    scheduledBucketKey({
      agentId: 'agent_123',
      intervalMinutes: 5,
      now: new Date('2026-05-14T09:07:12.000Z'),
      type: 'heartbeat',
    })
  ).toBe('sched:agent_123:heartbeat:5929165')
  expect(
    scheduledBucketKey({
      agentId: 'agent_123',
      intervalMinutes: 5,
      now: new Date('2026-05-14T09:07:12.000Z'),
      type: 'dreaming',
    })
  ).toBe('sched:agent_123:dreaming:5929165')
  expect(replyNamespaceForEvent('event_123')).toBe('reply:event_123')
})

test('daily scheduled keys use local date and HHmm slot', () => {
  expect(
    scheduledDailyKey({
      agentId: 'agent_123',
      localDate: '2026-05-14',
      time: '09:00',
      type: 'heartbeat',
    })
  ).toBe('sched:agent_123:heartbeat:daily:2026-05-14:0900')
  expect(
    scheduledDailyKey({
      agentId: 'agent_123',
      localDate: '2026-05-14',
      time: '17:30',
      type: 'dreaming',
    })
  ).toBe('sched:agent_123:dreaming:daily:2026-05-14:1730')
})
