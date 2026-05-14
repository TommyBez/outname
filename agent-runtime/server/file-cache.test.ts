import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeCachedAgentFilePaths } from '../shared/file-cache-index'

test('mergeCachedAgentFilePaths preserves existing entries when merging no files', () => {
  assert.deepEqual(mergeCachedAgentFilePaths(['AGENTS.md', 'USER.md'], []), [
    'AGENTS.md',
    'USER.md',
  ])
})

test('mergeCachedAgentFilePaths adds new paths once and sorts the index', () => {
  assert.deepEqual(
    mergeCachedAgentFilePaths(
      ['USER.md', 'AGENTS.md'],
      [{ path: 'logs/2026-05-14.md' }, { path: 'AGENTS.md' }]
    ),
    ['AGENTS.md', 'USER.md', 'logs/2026-05-14.md']
  )
})
