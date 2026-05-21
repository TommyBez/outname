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

import type { MaintainerTool } from '@/tools/catalog/types'
import { calcomRequestTool } from './calcom'
import { posthogRequestTool } from './posthog'
import { supabaseRequestTool } from './supabase'
import { typefullyRequestTool } from './typefully'
import { vercelRequestTool } from './vercel'
import { xApiRequestTool } from './x-api'

interface BuiltTool {
  execute(input: unknown): Promise<{
    code?: string
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

function buildTool(
  tool: MaintainerTool,
  config: Record<string, unknown> = {}
): BuiltTool {
  return tool.build({
    agentId: 'agent_test',
    config,
    conversationId: null,
    runId: 'run_test',
    toolId: tool.id,
    userId: 'user_test',
  }) as unknown as BuiltTool
}

describe('passthrough mutation safety policies', () => {
  beforeEach(() => {
    mockBrokeredHttpRequest.mockReset()
    mockRecordToolInvocation.mockReset()
    mockBrokeredHttpRequest.mockResolvedValue(successResponse)
  })

  it.each([
    [
      'x_api_request',
      xApiRequestTool,
      { readOnly: false },
      { method: 'POST', path: '/2/tweets', body: { text: 'hello' } },
    ],
    [
      'typefully_request',
      typefullyRequestTool,
      { readOnly: false },
      {
        method: 'POST',
        path: '/v2/social-sets/set_test/drafts',
        body: { content: 'hello' },
      },
    ],
    [
      'supabase_request',
      supabaseRequestTool,
      { readOnly: false },
      { method: 'POST', path: '/v1/projects', body: { name: 'project' } },
    ],
    [
      'vercel_request',
      vercelRequestTool,
      { readOnly: false },
      { method: 'POST', path: '/v10/projects', body: { name: 'project' } },
    ],
    [
      'posthog_request',
      posthogRequestTool,
      { projectId: '123', readOnly: false },
      {
        method: 'POST',
        path: '/api/projects/123/annotations/',
        body: { content: 'note' },
      },
    ],
    [
      'calcom_request',
      calcomRequestTool,
      { readOnly: false },
      { method: 'DELETE', path: '/webhooks/hook_test' },
    ],
  ])('%s allows non-GET calls without extra boolean gates', async (_name, tool, config, input) => {
    await expect(buildTool(tool, config).execute(input)).resolves.toMatchObject(
      {
        ok: true,
      }
    )

    expect(mockBrokeredHttpRequest).toHaveBeenCalledTimes(1)
  })

  it.each([
    [
      'x_api_request',
      xApiRequestTool,
      { readOnly: true },
      { method: 'POST', path: '/2/tweets', body: { text: 'hello' } },
    ],
    [
      'typefully_request',
      typefullyRequestTool,
      { readOnly: true },
      {
        method: 'POST',
        path: '/v2/social-sets/set_test/drafts',
        body: { content: 'hello' },
      },
    ],
    [
      'supabase_request',
      supabaseRequestTool,
      { readOnly: true },
      { method: 'POST', path: '/v1/projects', body: { name: 'project' } },
    ],
    [
      'vercel_request',
      vercelRequestTool,
      { readOnly: true },
      { method: 'POST', path: '/v10/projects', body: { name: 'project' } },
    ],
    [
      'posthog_request',
      posthogRequestTool,
      { projectId: '123', readOnly: true },
      {
        method: 'POST',
        path: '/api/projects/123/annotations/',
        body: { content: 'note' },
      },
    ],
    [
      'calcom_request',
      calcomRequestTool,
      { readOnly: true },
      { method: 'DELETE', path: '/webhooks/hook_test' },
    ],
  ])('%s still blocks non-GET calls when readOnly is enabled', async (_name, tool, config, input) => {
    await expect(buildTool(tool, config).execute(input)).resolves.toMatchObject(
      {
        code: 'policy_denied',
        ok: false,
      }
    )

    expect(mockBrokeredHttpRequest).not.toHaveBeenCalled()
  })

  it('Cal.com still rejects GET requests with bodies', async () => {
    await expect(
      buildTool(calcomRequestTool, { readOnly: false }).execute({
        method: 'GET',
        path: '/bookings',
        body: { unexpected: true },
      })
    ).resolves.toMatchObject({
      code: 'policy_denied',
      ok: false,
    })

    expect(mockBrokeredHttpRequest).not.toHaveBeenCalled()
  })

  it('Cal.com still rejects paths outside the allowlist', async () => {
    await expect(
      buildTool(calcomRequestTool, { readOnly: false }).execute({
        method: 'DELETE',
        path: '/organizations/org_test',
      })
    ).resolves.toMatchObject({
      code: 'policy_denied',
      ok: false,
    })

    expect(mockBrokeredHttpRequest).not.toHaveBeenCalled()
  })
})
