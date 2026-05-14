import { waitForHook, waitForSleep } from '@workflow/vitest'
import { describe, expect, it } from 'vitest'
import { getRun, resumeHook, resumeWebhook, start } from 'workflow/api'
import { approvalWorkflow, ingestWebhookWorkflow } from './runtime-workflows'

const WORKFLOW_RUN_ID_PATTERN = /^wrun_/

describe('approvalWorkflow', () => {
  it('publishes after approval and wake-up', async () => {
    const run = await start(approvalWorkflow, ['doc-approved'])

    expect(run.runId).toMatch(WORKFLOW_RUN_ID_PATTERN)

    await waitForHook(run, { token: 'approval:doc-approved' })
    await resumeHook('approval:doc-approved', {
      approved: true,
      reviewer: 'alice',
    })

    const sleepId = await waitForSleep(run)
    await getRun(run.runId).wakeUp({ correlationIds: [sleepId] })

    await expect(run.returnValue).resolves.toEqual({
      documentId: 'doc-approved',
      publicationId: 'pub:doc-approved',
      reviewer: 'alice',
      status: 'published',
    })
    await expect(run.status).resolves.toBe('completed')
  })

  it('rejects without waking sleeps when approval is denied', async () => {
    const run = await start(approvalWorkflow, ['doc-rejected'])

    await waitForHook(run, { token: 'approval:doc-rejected' })
    await resumeHook('approval:doc-rejected', {
      approved: false,
      reviewer: 'bob',
    })

    await expect(run.returnValue).resolves.toEqual({
      documentId: 'doc-rejected',
      reviewer: 'bob',
      status: 'rejected',
    })
    await expect(run.status).resolves.toBe('completed')
  })
})

describe('ingestWebhookWorkflow', () => {
  it('resumes webhook hooks with a Request payload', async () => {
    const run = await start(ingestWebhookWorkflow, ['endpoint-1'])
    const hook = await waitForHook(run)

    await resumeWebhook(
      hook.token,
      new Request('https://example.com/webhook', {
        body: JSON.stringify({
          event: 'order.created',
          orderId: '123',
        }),
        method: 'POST',
      })
    )

    await expect(run.returnValue).resolves.toEqual({
      endpointId: 'endpoint-1',
      payload: {
        event: 'order.created',
        orderId: '123',
      },
    })
    await expect(run.status).resolves.toBe('completed')
  })
})
