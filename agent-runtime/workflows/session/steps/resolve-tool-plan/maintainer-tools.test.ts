import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { MaintainerTool } from '@/tools/catalog/types'

const { mockDbSelect, mockGetMaintainerTool } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockGetMaintainerTool: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/shared/db', () => ({
  db: {
    select: mockDbSelect,
  },
}))

vi.mock('@/tools/catalog/registry', () => ({
  getMaintainerTool: mockGetMaintainerTool,
}))

import { resolveMaintainerRow } from './maintainer-tools'

describe('resolveMaintainerRow', () => {
  it('treats repo_workspace as provider-backed without checking snapshots', async () => {
    const tool: MaintainerTool = {
      build: vi.fn(),
      capabilities: [{ kind: 'repo_workspace', provider: 'github' }],
      category: 'developer',
      configSchema: z.object({
        allowExternalNetwork: z.boolean().default(true),
        readOnly: z.boolean().default(true),
        repoUrl: z.string(),
      }),
      description: 'Live GitHub repository workspace.',
      displayName: 'GitHub · Repo Workspace',
      exposedTools: [],
      id: 'github_repo',
      resolveExposedTools: vi.fn(() => []),
    }
    mockGetMaintainerTool.mockReturnValue(tool)

    await expect(
      resolveMaintainerRow({
        config: { repoUrl: 'https://github.com/acme/repo.git' },
        toolId: 'github_repo',
      })
    ).resolves.toEqual({
      kind: 'planned',
      planned: {
        config: {
          allowExternalNetwork: true,
          readOnly: true,
          repoUrl: 'https://github.com/acme/repo.git',
        },
        providerRequirements: [
          {
            provider: 'github',
            toolId: 'github_repo',
          },
        ],
        toolId: 'github_repo',
      },
    })
    expect(mockDbSelect).not.toHaveBeenCalled()
  })
})
