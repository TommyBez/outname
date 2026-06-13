import { expect, test } from 'vitest'
import type { RunEvent } from '../server/run-events'
import {
  eventSummaryToAgentChatMessage,
  eventSummaryToWorkflowStatus,
  fallbackEventTranscriptMessages,
  readEventActivityMetadata,
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

  expect(flushNdjsonBuffer<{ id: number }>('{"id":3}').values).toEqual([
    { id: 3 },
  ])
})

test('ndjson parser can skip malformed lines', () => {
  const parsed = parseNdjsonChunk<{ id: number }>(
    '',
    '{"id":1}\nnot-json\n{"id":2}\n',
    { skipInvalidLines: true }
  )
  expect(parsed.values).toEqual([{ id: 1 }, { id: 2 }])
  expect(parsed.skippedLines).toBe(1)
})

test('run events map to workflow status data', () => {
  const event: RunEvent = {
    message: 'Sub-agent invocation failed',
    status: 'failed',
    ts: 1_779_000_000_000,
    type: 'run',
  }

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

test('fallback event transcript prefers terminal failure details', () => {
  const completedAt = '2026-05-14T09:05:00.000Z'
  const messages = fallbackEventTranscriptMessages({
    attempt: 1,
    blockedByEventId: null,
    completedAt,
    id: 'evt_123',
    lastError: 'workflow storage expired',
    preview: null,
    queuedAt: '2026-05-14T09:00:00.000Z',
    source: 'manual',
    startedAt: '2026-05-14T09:00:01.000Z',
    status: 'failed',
    type: 'heartbeat',
    workflowRunId: 'run_123',
  })

  expect(messages).toHaveLength(1)
  expect(messages[0]?.parts[0]).toEqual({
    text: 'workflow storage expired',
    type: 'text',
  })
  expect(readEventActivityMetadata(messages[0])?.timestamp).toBe(completedAt)
})
