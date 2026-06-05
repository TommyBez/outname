import { describe, expect, it } from 'vitest'
import { GitHubSkillImportError, parseGitHubSkillUrl } from './github-import'

const SKILL_MD_PATTERN = /SKILL.md/

describe('parseGitHubSkillUrl', () => {
  it('accepts repository root URLs', () => {
    expect(parseGitHubSkillUrl('https://github.com/acme/skills')).toMatchObject(
      {
        isSkillMdFile: false,
        owner: 'acme',
        path: '',
        ref: 'HEAD',
        repo: 'skills',
      }
    )
  })

  it('accepts tree directory URLs', () => {
    expect(
      parseGitHubSkillUrl(
        'https://github.com/acme/skills/tree/main/grill-with-docs'
      )
    ).toMatchObject({
      isSkillMdFile: false,
      owner: 'acme',
      path: 'grill-with-docs',
      ref: 'main',
      repo: 'skills',
    })
  })

  it('infers the parent directory from blob SKILL.md URLs', () => {
    expect(
      parseGitHubSkillUrl(
        'https://github.com/acme/skills/blob/main/grill/SKILL.md'
      )
    ).toMatchObject({
      isSkillMdFile: true,
      path: 'grill',
      ref: 'main',
    })
  })

  it('rejects non-GitHub and credentialed URLs', () => {
    expect(() => parseGitHubSkillUrl('https://example.com/acme/repo')).toThrow(
      GitHubSkillImportError
    )
    expect(() =>
      parseGitHubSkillUrl('https://token@github.com/acme/repo')
    ).toThrow(GitHubSkillImportError)
  })

  it('rejects blob URLs that do not point at SKILL.md', () => {
    expect(() =>
      parseGitHubSkillUrl('https://github.com/acme/repo/blob/main/README.md')
    ).toThrow(SKILL_MD_PATTERN)
  })
})
