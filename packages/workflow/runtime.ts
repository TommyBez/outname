import {
  getWorkflowMetadata as readWorkflowMetadata,
  FatalError as WorkflowFatalError,
  RetryableError as WorkflowRetryableError,
  getWritable as workflowGetWritable,
} from 'workflow'

export const FatalError = WorkflowFatalError
export const getWorkflowMetadata = readWorkflowMetadata
export const getWritable = workflowGetWritable
export const RetryableError = WorkflowRetryableError
export type FatalError = InstanceType<typeof WorkflowFatalError>
export type RetryableError = InstanceType<typeof WorkflowRetryableError>
export type RetryableErrorOptions = import('workflow').RetryableErrorOptions

export function currentWorkflowRunId(): string {
  return readWorkflowMetadata().workflowRunId
}

export function nonRetryableStepError(message: string): WorkflowFatalError {
  return new WorkflowFatalError(message)
}

export function nonRetryableStepErrorFromUnknown(
  error: unknown,
  context: string
): WorkflowFatalError {
  if (error instanceof Error && error.name === 'FatalError') {
    return error as WorkflowFatalError
  }
  const detail = error instanceof Error ? error.message : String(error)
  return new WorkflowFatalError(detail ? `${context}: ${detail}` : context)
}

export function retryableStepError(
  message: string,
  options: RetryableErrorOptions
): WorkflowRetryableError {
  return new WorkflowRetryableError(message, options)
}
