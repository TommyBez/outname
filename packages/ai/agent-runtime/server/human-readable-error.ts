import 'server-only'
import { MissingInferenceCredentialError } from '@outname/shared/server/inference-provider-errors'
import { APICallError } from 'ai'

const GENERIC_MESSAGE =
  'Something went wrong while the agent was responding. Please try again in a moment.'

/**
 * Maps an arbitrary error — thrown or streamed during an agent run — to a
 * concise, user-facing message.
 *
 * Raw provider/internal errors are intentionally never surfaced verbatim: they
 * tend to leak request bodies, stack traces, or provider jargon. Callers are
 * expected to log the original error separately for debugging.
 */
export function humanReadableAgentError(error: unknown): string {
  if (error instanceof MissingInferenceCredentialError) {
    // Already written for the end user ("Add your key in Settings…").
    return error.message
  }
  if (APICallError.isInstance(error)) {
    return messageForApiCallError(error)
  }
  if (isAbortError(error)) {
    return 'The response was stopped before it finished.'
  }
  return GENERIC_MESSAGE
}

function messageForApiCallError(error: APICallError): string {
  const status = error.statusCode
  if (status === 401 || status === 403) {
    return 'Your inference provider rejected the request. Check that your API key is still valid in Settings.'
  }
  if (status === 429) {
    return 'The inference provider is rate limiting requests right now. Please wait a moment and try again.'
  }
  if (status !== undefined && status >= 500) {
    return 'The inference provider had a temporary error. Please try again in a moment.'
  }
  return 'The inference provider could not complete the request. Please try again.'
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
