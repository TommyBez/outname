import { expect, test } from 'vitest'
import { mergeCachedAgentFilePaths } from '../shared/file-cache-index'

test('mergeCachedAgentFilePaths preserves existing entries when merging no files', () => {
  expect(mergeCachedAgentFilePaths(['AGENTS.md', 'USER.md'], [])).toEqual([
    'AGENTS.md',
    'USER.md',
  ])
})

test('mergeCachedAgentFilePaths adds new paths once and sorts the index', () => {
  expect(
    mergeCachedAgentFilePaths(
      ['USER.md', 'AGENTS.md'],
      [{ path: 'logs/2026-05-14.md' }, { path: 'AGENTS.md' }]
    )
  ).toEqual(['AGENTS.md', 'USER.md', 'logs/2026-05-14.md'])
})
