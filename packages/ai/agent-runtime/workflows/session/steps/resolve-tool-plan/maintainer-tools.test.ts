import type { MaintainerTool } from '@outname/ai/tools/catalog/types'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const { mockDbSelect, mockGetMaintainerTool } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockGetMaintainerTool: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/db', () => ({
  db: {
    select: mockDbSelect,
  },
}))

vi.mock('@outname/ai/tools/catalog/registry', () => ({
  getMaintainerTool: mockGetMaintainerTool,
}))

import { resolveMaintainerRow } from './maintainer-tools'

describe('resolveMaintainerRow', () => {
  it('treats repo_workspace as connector-backed without checking snapshots', async () => {
    const tool: MaintainerTool = {
      build: vi.fn(),
      capabilities: [
        {
          kind: 'repo_workspace',
          connectorId: 'github.personal_access_token',
        },
      ],
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
        connectorRequirements: [
          {
            connectorId: 'github.personal_access_token',
            toolId: 'github_repo',
          },
        ],
        toolConfig: {
          allowExternalNetwork: true,
          readOnly: true,
          repoUrl: 'https://github.com/acme/repo.git',
        },
        toolId: 'github_repo',
      },
    })
    expect(mockDbSelect).not.toHaveBeenCalled()
  })

  it('preserves encrypted credential overrides and skips connection requirements for them', async () => {
    const tool: MaintainerTool = {
      build: vi.fn(),
      capabilities: [{ kind: 'brokered_http', connectorId: 'x.bearer_token' }],
      category: 'social',
      configSchema: z.strictObject({
        readOnly: z.boolean().default(false),
      }),
      description: 'Call X API endpoints.',
      displayName: 'X API',
      exposedTools: [],
      id: 'x_api_request',
      resolveExposedTools: vi.fn(() => []),
    }
    mockGetMaintainerTool.mockReturnValue(tool)

    await expect(
      resolveMaintainerRow({
        config: {
          _secrets: {
            credentialOverrides: {
              'x.bearer_token': {
                encrypted: 'encrypted-token',
                version: 1,
              },
            },
          },
          readOnly: true,
        },
        toolId: 'x_api_request',
      })
    ).resolves.toEqual({
      kind: 'planned',
      planned: {
        config: {
          readOnly: true,
        },
        connectorRequirements: [],
        toolConfig: {
          _secrets: {
            credentialOverrides: {
              'x.bearer_token': {
                encrypted: 'encrypted-token',
                version: 1,
              },
            },
          },
          readOnly: true,
        },
        toolId: 'x_api_request',
      },
    })
  })
})
