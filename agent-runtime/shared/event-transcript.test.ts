import { expect, test } from 'vitest'
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
  expect(first.values).toEqual([{ id: 1 }])
  expect(first.buffer).toBe('{"id"')

  const second = parseNdjsonChunk<{ id: number }>(first.buffer, ':2}\n')
  expect(second.values).toEqual([{ id: 2 }])
  expect(second.buffer).toBe('')

  expect(flushNdjsonBuffer<{ id: number }>('{"id":3}')).toEqual([{ id: 3 }])
})

test('run events map to compact transcript activity messages', () => {
  const event: RunEvent = {
    message: 'Sub-agent invocation failed',
    status: 'failed',
    ts: 1_779_000_000_000,
    type: 'run',
  }

  const message = runEventToAgentChatMessage(event, 0)
  expect(message.role).toBe('assistant')
  expect(message.parts[0]?.type).toBe('text')
  expect(readEventActivityMetadata(message)?.tone).toBe('error')
  expect(readEventActivityMetadata(message)?.transient).toBe(true)

  const status = runEventToWorkflowStatus(event)
  expect(status.message).toBe('Failed: Sub-agent invocation failed')
  expect(status.phase).toBe('agent-stream')
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

  expect(message.id).toBe('event:evt_123:queued')
  expect(readEventActivityMetadata(message)?.tone).toBe('default')
  expect(readEventActivityMetadata(message)?.transient).toBe(true)

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
  expect(status.message).toBe(
    'Event queued. Waiting for the worker to pick it up.'
  )
})
