import { MissingInferenceCredentialError } from '@outname/shared/server/inference-provider-errors'
import { APICallError } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import { humanReadableAgentError } from './human-readable-error'

vi.mock('server-only', () => ({}))

function apiError(statusCode?: number): APICallError {
  return new APICallError({
    isRetryable: false,
    message: 'raw provider message',
    requestBodyValues: {},
    statusCode,
    url: 'https://example.test/v1/messages',
  })
}

describe('humanReadableAgentError', () => {
  it('passes through the already user-facing missing-credential message', () => {
    const error = new MissingInferenceCredentialError('vercel-ai-gateway')
    expect(humanReadableAgentError(error)).toBe(error.message)
  })

  it('maps auth status codes to a credentials hint', () => {
    expect(humanReadableAgentError(apiError(401))).toContain('API key')
    expect(humanReadableAgentError(apiError(403))).toContain('API key')
  })

  it('maps 429 to a rate-limit message', () => {
    expect(humanReadableAgentError(apiError(429))).toContain('rate limiting')
  })

  it('maps 5xx to a temporary-error message', () => {
    expect(humanReadableAgentError(apiError(503))).toContain('temporary error')
  })

  it('never leaks the raw provider message for unknown errors', () => {
    const message = humanReadableAgentError(new Error('stack trace: secret'))
    expect(message).not.toContain('secret')
    expect(message).toBe(
      'Something went wrong while the agent was responding. Please try again in a moment.'
    )
  })

  it('reports aborted responses distinctly', () => {
    const aborted = new Error('aborted')
    aborted.name = 'AbortError'
    expect(humanReadableAgentError(aborted)).toBe(
      'The response was stopped before it finished.'
    )
  })
})
