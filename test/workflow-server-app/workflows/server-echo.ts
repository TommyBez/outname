import { currentWorkflowRunId } from '@outname/shared/server/workflow-run-id'

export async function serverEchoWorkflow(input: {
  documentId: string
  value: number
}): Promise<{
  documentId: string
  doubled: number
  workflowRunId: string
}> {
  'use workflow'

  return {
    documentId: input.documentId,
    doubled: await doubleValueStep(input.value),
    workflowRunId: currentWorkflowRunId(),
  }
}

async function doubleValueStep(value: number): Promise<number> {
  'use step'
  await Promise.resolve()

  return value * 2
}
