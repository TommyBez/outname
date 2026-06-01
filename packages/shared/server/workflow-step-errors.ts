import {
  FatalError,
  RetryableError,
  type RetryableErrorOptions,
} from '@outname/workflow/runtime'

export function nonRetryableStepError(message: string): FatalError {
  return new FatalError(message)
}

export function nonRetryableStepErrorFromUnknown(
  error: unknown,
  context: string
): FatalError {
  if (error instanceof Error && error.name === 'FatalError') {
    return error as FatalError
  }

  const detail = error instanceof Error ? error.message : String(error)
  return new FatalError(detail ? `${context}: ${detail}` : context)
}

export function delayedRetryStepError(
  message: string,
  options: RetryableErrorOptions
): RetryableError {
  return new RetryableError(message, options)
}
