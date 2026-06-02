import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockBrokeredHttpRequest, mockRecordToolInvocation } = vi.hoisted(
  () => ({
    mockBrokeredHttpRequest: vi.fn(),
    mockRecordToolInvocation: vi.fn(),
  })
)

vi.mock('server-only', () => ({}))

vi.mock('@outname/ai/tools/runtime/audit', () => ({
  recordToolInvocation: mockRecordToolInvocation,
}))

vi.mock('@outname/ai/tools/runtime/brokered-http', () => ({
  brokeredHttpRequest: mockBrokeredHttpRequest,
}))

import { xOAuthConnector } from '@outname/shared/connections/x'
import { X_OAUTH_SCOPES } from '@outname/shared/connections/x-oauth-scopes'
import { xApiRequestTool, xUserApiRequestTool } from './x-api'

interface BuiltTool {
  execute(input: unknown): Promise<{
    code?: string
    message?: string
    ok: boolean
  }>
}

const successResponse = {
  bodyText: '{}',
  headers: {},
  ok: true,
  status: 200,
  truncated: false,
}

const buildXUserTool = (config: Record<string, unknown> = {}) =>
  xUserApiRequestTool.build({
    agentId: 'agent_test',
    config,
    conversationId: null,
    runId: 'run_test',
    toolId: 'x_user_api_request',
    userId: 'user_test',
  }) as unknown as BuiltTool

const buildXAppTool = (config: Record<string, unknown> = {}) =>
  xApiRequestTool.build({
    agentId: 'agent_test',
    config,
    conversationId: null,
    runId: 'run_test',
    toolId: 'x_api_request',
    userId: 'user_test',
  }) as unknown as BuiltTool

describe('xApiRequestTool', () => {
  beforeEach(() => {
    mockBrokeredHttpRequest.mockReset()
    mockRecordToolInvocation.mockReset()
    mockBrokeredHttpRequest.mockResolvedValue(successResponse)
  })

  it.each([
    '/2/dm_events',
    '/2/spaces/123',
    '/2/spaces/search',
  ])('allows app Bearer paths that match declared v2 resource keys: %s', async (path) => {
    await expect(
      buildXAppTool().execute({
        method: 'GET',
        path,
      })
    ).resolves.toMatchObject({
      ok: true,
    })

    expect(mockBrokeredHttpRequest).toHaveBeenCalledTimes(1)
  })

  it('rejects the nonexistent /2/dm path prefix', async () => {
    await expect(
      buildXAppTool().execute({
        method: 'GET',
        path: '/2/dm/legacy',
      })
    ).resolves.toMatchObject({
      code: 'policy_denied',
      ok: false,
    })

    expect(mockBrokeredHttpRequest).not.toHaveBeenCalled()
  })

  it('respects per-group enable flags for app resources', async () => {
    await expect(
      buildXAppTool({ enableGroupSpaces: false }).execute({
        method: 'GET',
        path: '/2/spaces/123',
      })
    ).resolves.toMatchObject({
      code: 'policy_denied',
      ok: false,
    })

    expect(mockBrokeredHttpRequest).not.toHaveBeenCalled()
  })
})

describe('xUserApiRequestTool', () => {
  beforeEach(() => {
    mockBrokeredHttpRequest.mockReset()
    mockRecordToolInvocation.mockReset()
    mockBrokeredHttpRequest.mockResolvedValue(successResponse)
  })

  it('uses the shared X OAuth scope bundle for connector and tool requirements', () => {
    const capability = xUserApiRequestTool.capabilities.find(
      (item) => item.kind === 'brokered_http'
    )

    expect(xOAuthConnector.oauth2.defaultScopes).toEqual(X_OAUTH_SCOPES)
    expect(capability).toMatchObject({
      connectorId: 'x.oauth2_user',
      requiredScopes: X_OAUTH_SCOPES,
    })
  })

  it.each([
    '/2/dm_conversations',
    '/2/dm_events',
    '/2/lists/123/tweets',
    '/2/users/123/list_memberships',
    '/2/users/123/followed_lists',
    '/2/users/123/blocking',
    '/2/users/123/muting',
    '/2/spaces/123',
  ])('allows OAuth user-context paths on the declared v2 surface: %s', async (path) => {
    await expect(
      buildXUserTool().execute({
        method: 'GET',
        path,
      })
    ).resolves.toMatchObject({
      ok: true,
    })

    expect(mockBrokeredHttpRequest).toHaveBeenCalledTimes(1)
  })

  it.each([
    '/2/account/settings',
    '/2/webhooks',
    '/2/tweets/search/stream',
  ])('rejects paths outside the OAuth user resource registry: %s', async (path) => {
    await expect(
      buildXUserTool().execute({
        method: 'GET',
        path,
      })
    ).resolves.toMatchObject({
      code: 'policy_denied',
      ok: false,
    })

    expect(mockBrokeredHttpRequest).not.toHaveBeenCalled()
  })

  it('respects per-group enable flags for OAuth resources', async () => {
    await expect(
      buildXUserTool({ enableGroupLists: false }).execute({
        method: 'GET',
        path: '/2/lists/123/tweets',
      })
    ).resolves.toMatchObject({
      code: 'policy_denied',
      ok: false,
    })

    expect(mockBrokeredHttpRequest).not.toHaveBeenCalled()
  })
})
