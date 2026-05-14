import { describe, expect, it } from 'vitest'
import { start } from 'workflow/api'
import { serverEchoWorkflow } from '@/tools/testing/server-workflow'

const WORKFLOW_RUN_ID_PATTERN = /^wrun_/

describe('serverEchoWorkflow', () => {
  it('runs through the Next.js workflow server', async () => {
    const run = await start(serverEchoWorkflow, [
      {
        documentId: 'doc-server',
        value: 21,
      },
    ])

    expect(run.runId).toMatch(WORKFLOW_RUN_ID_PATTERN)
    await expect(run.returnValue).resolves.toEqual({
      documentId: 'doc-server',
      doubled: 42,
    })
    await expect(run.status).resolves.toBe('completed')
  })
})
