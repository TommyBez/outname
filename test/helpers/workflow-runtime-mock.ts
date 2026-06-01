export class MockFatalError extends Error {
  fatal = true

  constructor(message: string) {
    super(message)
    this.name = 'FatalError'
  }
}

export class MockRetryableError extends Error {
  retryAfter: Date

  constructor(message: string, options?: { retryAfter?: Date }) {
    super(message)
    this.name = 'RetryableError'
    this.retryAfter = options?.retryAfter ?? new Date()
  }
}

export function nonRetryableStepError(message: string): MockFatalError {
  return new MockFatalError(message)
}

export function nonRetryableStepErrorFromUnknown(
  error: unknown,
  context: string
): MockFatalError {
  if (error instanceof Error && error.name === 'FatalError') {
    return error as MockFatalError
  }

  const detail = error instanceof Error ? error.message : String(error)
  return new MockFatalError(detail ? `${context}: ${detail}` : context)
}

export function retryableStepError(
  message: string,
  _options?: { retryAfter?: Date }
): MockRetryableError {
  return new MockRetryableError(message, _options)
}

export function createWorkflowRuntimeMock(overrides?: {
  getWorkflowMetadata?: () => { workflowRunId: string }
  getWritable?: () => unknown
}) {
  const getWorkflowMetadata =
    overrides?.getWorkflowMetadata ?? (() => ({ workflowRunId: 'wrun_test' }))

  return {
    FatalError: MockFatalError,
    RetryableError: MockRetryableError,
    currentWorkflowRunId: () => getWorkflowMetadata().workflowRunId,
    getWorkflowMetadata,
    getWritable:
      overrides?.getWritable ??
      (() => ({
        getWriter: () => ({
          releaseLock: () => undefined,
          write: async () => undefined,
        }),
      })),
    nonRetryableStepError,
    nonRetryableStepErrorFromUnknown,
    retryableStepError,
  }
}
