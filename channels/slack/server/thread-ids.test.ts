import { expect, test } from 'vitest'
import { extractSlackThread } from './thread-ids'

test('extractSlackThread uses ts for top-level DM messages', () => {
  const result = extractSlackThread(
    {
      channelId: 'slack:D123',
      id: 'slack:D123:1234567890.123456',
    },
    {
      channel: 'D123',
      ts: '1234567890.123456',
    }
  )

  expect(result).toEqual({
    channelId: 'D123',
    threadTs: '1234567890.123456',
  })
})

test('extractSlackThread prefers thread_ts when a reply is already threaded', () => {
  const result = extractSlackThread(
    {
      channelId: 'slack:D123',
      id: 'slack:D123:1234567890.123456',
    },
    {
      channel: 'D123',
      thread_ts: '1234567890.123456',
      ts: '1234567899.999999',
    }
  )

  expect(result).toEqual({
    channelId: 'D123',
    threadTs: '1234567890.123456',
  })
})

test('extractSlackThread falls back to SDK ids when raw payload is missing', () => {
  const result = extractSlackThread(
    {
      channelId: 'slack:D123',
      id: 'slack:D123:1234567890.123456',
    },
    undefined
  )

  expect(result).toEqual({
    channelId: 'D123',
    threadTs: '1234567890.123456',
  })
})

test('extractSlackThread rejects malformed SDK ids with an empty thread suffix', () => {
  const result = extractSlackThread(
    {
      channelId: 'slack:D123',
      id: 'slack:D123:',
    },
    undefined
  )

  expect(result).toBeNull()
})
