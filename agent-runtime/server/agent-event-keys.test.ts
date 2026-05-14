import assert from 'node:assert/strict'
import test from 'node:test'
import {
  eventActivityNamespace,
  replyNamespaceForEvent,
  scheduledBucketKey,
  scheduledConcurrencyKey,
  scheduledDailyKey,
  slackConcurrencyKey,
  slackIdempotencyKey,
} from './agent-event-keys'

test('slack event keys isolate duplicate messages from same-thread ordering', () => {
  assert.equal(
    slackIdempotencyKey({
      agentId: 'agent_123',
      channelId: 'C123',
      messageTs: '1715680800.123456',
      teamId: 'T123',
    }),
    'slack:T123:C123:1715680800.123456:agent_123'
  )

  assert.equal(
    slackConcurrencyKey({
      agentId: 'agent_123',
      channelId: 'C123',
      teamId: 'T123',
      threadTs: '1715680000.000001',
    }),
    'slack:T123:C123:1715680000.000001:agent_123'
  )
})

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

  assert.equal(
    heartbeatKey,
    scheduledBucketKey({
      agentId: 'agent_123',
      intervalMinutes: 5,
      now: sameBucket,
      type: 'heartbeat',
    })
  )
  assert.notEqual(
    heartbeatKey,
    scheduledBucketKey({
      agentId: 'agent_123',
      intervalMinutes: 5,
      now: nextBucket,
      type: 'heartbeat',
    })
  )
  assert.notEqual(
    heartbeatKey,
    scheduledBucketKey({
      agentId: 'agent_123',
      intervalMinutes: 5,
      now,
      type: 'dreaming',
    })
  )
})

test('scheduled concurrency and stream namespaces are stable', () => {
  assert.equal(
    scheduledConcurrencyKey({
      agentId: 'agent_123',
      intervalMinutes: 5,
      now: new Date('2026-05-14T09:07:12.000Z'),
      type: 'heartbeat',
    }),
    'sched:agent_123:heartbeat:5929165'
  )
  assert.equal(
    scheduledConcurrencyKey({
      agentId: 'agent_123',
      intervalMinutes: 5,
      now: new Date('2026-05-14T09:07:12.000Z'),
      type: 'dreaming',
    }),
    'sched:agent_123:dreaming:5929165'
  )
  assert.equal(replyNamespaceForEvent('event_123'), 'reply:event_123')
  assert.equal(eventActivityNamespace('run_123'), 'events:run_123')
})

test('daily scheduled keys use local date and HHmm slot', () => {
  assert.equal(
    scheduledDailyKey({
      agentId: 'agent_123',
      localDate: '2026-05-14',
      time: '09:00',
      type: 'heartbeat',
    }),
    'sched:agent_123:heartbeat:daily:2026-05-14:0900'
  )
  assert.equal(
    scheduledDailyKey({
      agentId: 'agent_123',
      localDate: '2026-05-14',
      time: '17:30',
      type: 'dreaming',
    }),
    'sched:agent_123:dreaming:daily:2026-05-14:1730'
  )
})
