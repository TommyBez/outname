import { expect, test } from 'vitest'
import { describeSlackAttachments, extractSlackThread } from './thread-ids'

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

test('describeSlackAttachments returns empty string when no files are present', () => {
  expect(describeSlackAttachments(undefined)).toBe('')
  expect(describeSlackAttachments({})).toBe('')
  expect(describeSlackAttachments({ files: [] })).toBe('')
})

test('describeSlackAttachments lists name and mimetype for each file', () => {
  const result = describeSlackAttachments({
    files: [
      { name: 'cover.png', mimetype: 'image/png' },
      { name: 'report.pdf', mimetype: 'application/pdf' },
    ],
  })
  expect(result).toBe('cover.png (image/png), report.pdf (application/pdf)')
})

test('describeSlackAttachments falls back to title then a generic label', () => {
  const result = describeSlackAttachments({
    files: [
      { title: 'Untitled image', mimetype: 'image/jpeg' },
      { mimetype: 'image/gif' },
    ],
  })
  expect(result).toBe('Untitled image (image/jpeg), attachment (image/gif)')
})

test('describeSlackAttachments omits the mimetype when missing', () => {
  const result = describeSlackAttachments({
    files: [{ name: 'notes.txt' }],
  })
  expect(result).toBe('notes.txt')
})
