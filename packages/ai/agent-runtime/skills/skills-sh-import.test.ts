import { getVercelOidcToken } from '@vercel/oidc'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSkillsShLeaderboard,
  getSkillsShSkillAudit,
  importSkillsShSkill,
  searchSkillsShSkills,
} from './skills-sh-import'

vi.mock('@vercel/oidc', () => ({
  getVercelOidcToken: vi.fn(),
}))

const VALID_SKILL_MD = `---
name: Catalog Skill
description: Installed from skills.sh.
---

Use the catalog.
`

const fetchMock = vi.fn<typeof fetch>()

describe('skills.sh import', () => {
  beforeEach(() => {
    vi.mocked(getVercelOidcToken).mockResolvedValue('oidc-token')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('searches with Vercel OIDC authentication', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        count: 1,
        data: [catalogSkill()],
        durationMs: 12,
        query: 'nextjs',
        searchType: 'fuzzy',
      })
    )

    const result = await searchSkillsShSkills({ query: 'nextjs' })

    expect(result.data[0]?.id).toBe('vercel-labs/skills/find-skills')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://skills.sh/api/v1/skills/search?q=nextjs',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer oidc-token',
        }),
      })
    )
  })

  it('loads the all-time leaderboard with install-count ordering from skills.sh', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [catalogSkill()],
        pagination: {
          hasMore: true,
          page: 0,
          perPage: 50,
          total: 8420,
        },
      })
    )

    const result = await getSkillsShLeaderboard({
      page: 0,
      perPage: 50,
      view: 'all-time',
    })

    expect(result.data[0]?.id).toBe('vercel-labs/skills/find-skills')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://skills.sh/api/v1/skills?view=all-time&page=0&per_page=50',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer oidc-token',
        }),
      })
    )
  })

  it('imports detail files and infers executable scripts from shebangs', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        files: [
          { contents: VALID_SKILL_MD, path: 'SKILL.md' },
          {
            contents: '#!/usr/bin/env bash\necho ok\n',
            path: 'scripts/run.sh',
          },
          { contents: 'notes', path: 'README.md' },
        ],
        hash: 'remote-hash',
        id: 'vercel-labs/skills/find-skills',
        installs: 12,
        slug: 'find-skills',
        source: 'vercel-labs/skills',
      })
    )

    const imported = await importSkillsShSkill('vercel-labs/skills/find-skills')

    expect(imported.detail.hash).toBe('remote-hash')
    expect(imported.package.name).toBe('Catalog Skill')
    expect(
      imported.package.files.find((file) => file.path === 'scripts/run.sh')
    ).toMatchObject({ executable: true })
    expect(
      imported.package.files.find((file) => file.path === 'README.md')
    ).toMatchObject({ executable: false })
  })

  it('treats missing audits as an empty audit state', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'not_found', message: 'No audits.' }, 404)
    )

    await expect(
      getSkillsShSkillAudit('vercel-labs/skills/find-skills')
    ).resolves.toBeNull()
  })
})

function catalogSkill() {
  return {
    id: 'vercel-labs/skills/find-skills',
    installUrl: 'https://github.com/vercel-labs/skills',
    installs: 12,
    name: 'find-skills',
    slug: 'find-skills',
    source: 'vercel-labs/skills',
    sourceType: 'github',
    url: 'https://skills.sh/vercel-labs/skills/find-skills',
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  })
}
