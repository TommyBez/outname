import { describe, expect, it } from 'vitest'
import {
  normalizeRepoWorkspacePath,
  normalizeRepoWorkspacePrefix,
  relativeToRepoWorkspaceRoot,
} from './paths'

describe('repo workspace paths', () => {
  it('canonicalizes rootPath before deriving relative paths', () => {
    const rootPath = '/vercel/sandbox/./'

    expect(normalizeRepoWorkspacePath('src/index.ts', rootPath)).toEqual({
      absPath: '/vercel/sandbox/src/index.ts',
      relPath: 'src/index.ts',
    })
    expect(
      normalizeRepoWorkspacePath('/vercel/sandbox/./src/index.ts', rootPath)
    ).toEqual({
      absPath: '/vercel/sandbox/src/index.ts',
      relPath: 'src/index.ts',
    })
    expect(normalizeRepoWorkspacePrefix(undefined, rootPath)).toEqual({
      absPath: '/vercel/sandbox',
      relPath: '',
    })
    expect(
      relativeToRepoWorkspaceRoot('/vercel/sandbox/./src/index.ts', rootPath)
    ).toBe('src/index.ts')
  })
})
