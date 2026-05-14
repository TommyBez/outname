import assert from 'node:assert/strict'
import test from 'node:test'
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

  assert.deepEqual(result, {
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

  assert.deepEqual(result, {
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

  assert.deepEqual(result, {
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

  assert.equal(result, null)
})

test('describeSlackAttachments returns empty string when no files are present', () => {
  assert.equal(describeSlackAttachments(undefined), '')
  assert.equal(describeSlackAttachments({}), '')
  assert.equal(describeSlackAttachments({ files: [] }), '')
})

test('describeSlackAttachments lists name and mimetype for each file', () => {
  const result = describeSlackAttachments({
    files: [
      { name: 'cover.png', mimetype: 'image/png' },
      { name: 'report.pdf', mimetype: 'application/pdf' },
    ],
  })
  assert.equal(result, 'cover.png (image/png), report.pdf (application/pdf)')
})

test('describeSlackAttachments falls back to title then a generic label', () => {
  const result = describeSlackAttachments({
    files: [
      { title: 'Untitled image', mimetype: 'image/jpeg' },
      { mimetype: 'image/gif' },
    ],
  })
  assert.equal(result, 'Untitled image (image/jpeg), attachment (image/gif)')
})

test('describeSlackAttachments omits the mimetype when missing', () => {
  const result = describeSlackAttachments({
    files: [{ name: 'notes.txt' }],
  })
  assert.equal(result, 'notes.txt')
})
