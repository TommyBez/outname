import assert from 'node:assert/strict'
import test from 'node:test'
import type { RunEvent } from '../server/run-events'
import {
  eventSummaryToAgentChatMessage,
  eventSummaryToWorkflowStatus,
  readEventActivityMetadata,
  runEventToAgentChatMessage,
  runEventToWorkflowStatus,
} from './event-transcript'
import { flushNdjsonBuffer, parseNdjsonChunk } from './ndjson'

test('ndjson parser handles split chunks and trailing buffers', () => {
  const first = parseNdjsonChunk<{ id: number }>('', '{"id":1}\n{"id"')
  assert.deepEqual(first.values, [{ id: 1 }])
  assert.equal(first.buffer, '{"id"')

  const second = parseNdjsonChunk<{ id: number }>(first.buffer, ':2}\n')
  assert.deepEqual(second.values, [{ id: 2 }])
  assert.equal(second.buffer, '')

  assert.deepEqual(flushNdjsonBuffer<{ id: number }>('{"id":3}'), [{ id: 3 }])
})

test('run events map to compact transcript activity messages', () => {
  const event: RunEvent = {
    message: 'Sub-agent invocation failed',
    status: 'failed',
    ts: 1_779_000_000_000,
    type: 'run',
  }

  const message = runEventToAgentChatMessage(event, 0)
  assert.equal(message.role, 'assistant')
  assert.equal(message.parts[0]?.type, 'text')
  assert.equal(readEventActivityMetadata(message)?.tone, 'error')
  assert.equal(readEventActivityMetadata(message)?.transient, true)

  const status = runEventToWorkflowStatus(event)
  assert.equal(status.message, 'Failed: Sub-agent invocation failed')
  assert.equal(status.phase, 'agent-stream')
})

test('event summaries produce stable transcript status messages', () => {
  const message = eventSummaryToAgentChatMessage({
    attempt: 1,
    blockedByEventId: null,
    completedAt: null,
    id: 'evt_123',
    lastError: null,
    preview: 'Manual heartbeat',
    queuedAt: '2026-05-14T09:00:00.000Z',
    source: 'manual',
    startedAt: null,
    status: 'queued',
    type: 'heartbeat',
    workflowRunId: null,
  })

  assert.equal(message.id, 'event:evt_123:queued')
  assert.equal(readEventActivityMetadata(message)?.tone, 'default')
  assert.equal(readEventActivityMetadata(message)?.transient, true)

  const status = eventSummaryToWorkflowStatus({
    attempt: 1,
    blockedByEventId: null,
    completedAt: null,
    id: 'evt_123',
    lastError: null,
    preview: 'Manual heartbeat',
    queuedAt: '2026-05-14T09:00:00.000Z',
    source: 'manual',
    startedAt: null,
    status: 'queued',
    type: 'heartbeat',
    workflowRunId: null,
  })
  assert.equal(
    status.message,
    'Event queued. Waiting for the worker to pick it up.'
  )
})
