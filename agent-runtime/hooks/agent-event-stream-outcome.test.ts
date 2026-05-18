import { expect, test } from 'vitest'
import type { AgentEventSummary } from '@/agent-runtime/shared/event-types'
import {
  backoffMs,
  resolveTranscriptOutcome,
  shouldRetryAfterStreamEnd,
} from './agent-event-stream-outcome'

const baseEvent: AgentEventSummary = {
  attempt: 1,
  blockedByEventId: null,
  completedAt: null,
  id: 'evt_1',
  lastError: null,
  preview: null,
  queuedAt: '2026-05-14T09:00:00.000Z',
  source: 'manual',
  startedAt: '2026-05-14T09:00:01.000Z',
  status: 'running',
  type: 'heartbeat',
  workflowRunId: 'run_1',
}

test('shouldRetryAfterStreamEnd is false for terminal events', () => {
  expect(shouldRetryAfterStreamEnd({ ...baseEvent, status: 'completed' })).toBe(
    false
  )
  expect(shouldRetryAfterStreamEnd({ ...baseEvent, status: 'running' })).toBe(
    true
  )
})

test('resolveTranscriptOutcome fails when output errors with no messages on live run', () => {
  const outcome = resolveTranscriptOutcome({
    activityError: null,
    event: baseEvent,
    hasMessages: false,
    outputError: 'network',
  })
  expect(outcome).toEqual({ kind: 'failed', message: 'network' })
})

test('resolveTranscriptOutcome recovers from output error when event is terminal', () => {
  const outcome = resolveTranscriptOutcome({
    activityError: null,
    event: { ...baseEvent, status: 'completed' },
    hasMessages: false,
    outputError: 'network',
  })
  expect(outcome).toEqual({ kind: 'ready' })
})

test('resolveTranscriptOutcome warns when only activity stream fails', () => {
  const outcome = resolveTranscriptOutcome({
    activityError: 'activity down',
    event: baseEvent,
    hasMessages: true,
    outputError: null,
  })
  expect(outcome).toEqual({
    kind: 'partial',
    message: null,
    warning: 'activity down',
  })
})

test('backoffMs caps at the final interval', () => {
  expect(backoffMs(0)).toBe(1000)
  expect(backoffMs(99)).toBe(8000)
})
