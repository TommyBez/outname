import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockBrokeredHttpRequest, mockRecordToolInvocation } = vi.hoisted(
  () => ({
    mockBrokeredHttpRequest: vi.fn(),
    mockRecordToolInvocation: vi.fn(),
  })
)

vi.mock('server-only', () => ({}))

vi.mock('@/tools/runtime/audit', () => ({
  recordToolInvocation: mockRecordToolInvocation,
}))

vi.mock('@/tools/runtime/brokered-http', () => ({
  brokeredHttpRequest: mockBrokeredHttpRequest,
}))

import { xOAuthConnector } from '@/connections/x'
import { X_OAUTH_SCOPES } from '@/connections/x-oauth-scopes'
import { xUserApiRequestTool } from './x-api'

interface BuiltTool {
  execute(input: unknown): Promise<{
    code?: string
    message?: string
    ok: boolean
  }>
}

const buildXUserTool = () =>
  xUserApiRequestTool.build({
    agentId: 'agent_test',
    config: {},
    conversationId: null,
    runId: 'run_test',
    toolId: 'x_user_api_request',
    userId: 'user_test',
  }) as unknown as BuiltTool

describe('xUserApiRequestTool', () => {
  beforeEach(() => {
    mockBrokeredHttpRequest.mockReset()
    mockRecordToolInvocation.mockReset()
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
    '/2/lists/123/tweets',
    '/2/users/123/list_memberships',
    '/2/users/123/followed_lists',
    '/2/users/123/blocking',
    '/2/users/123/muting',
    '/2/spaces/123',
  ])('rejects user-context path outside the declared v2 surface: %s', async (path) => {
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
})
