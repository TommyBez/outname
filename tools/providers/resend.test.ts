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

import { resendSendTool } from './resend'

interface BuiltTool {
  execute(input: unknown): Promise<{
    data?: { id: string }
    ok: boolean
  }>
}

describe('resendSendTool', () => {
  beforeEach(() => {
    mockBrokeredHttpRequest.mockReset()
    mockRecordToolInvocation.mockReset()
    mockBrokeredHttpRequest.mockResolvedValue({
      bodyText: '{"id":"email_123"}',
      headers: {},
      ok: true,
      status: 200,
      truncated: false,
    })
  })

  it('uses the canonical Resend connector id for brokered HTTP calls', async () => {
    const built = resendSendTool.build({
      agentId: 'agent_test',
      config: { fromEmail: 'alerts@example.com' },
      conversationId: null,
      runId: 'run_test',
      toolId: 'resend_send',
      userId: 'user_test',
    }) as unknown as BuiltTool

    await expect(
      built.execute({
        subject: 'Hello',
        text: 'Body',
        to: 'user@example.com',
      })
    ).resolves.toEqual({
      data: { id: 'email_123' },
      ok: true,
    })

    expect(mockBrokeredHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorId: 'resend.api_key',
        request: expect.objectContaining({
          method: 'POST',
          url: 'https://api.resend.com/emails',
        }),
      })
    )
  })
})
