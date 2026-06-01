import 'server-only'

import { readConnectorCredential } from './credential-resolver'
import { type ToolFailure, toolError } from './tool-result'

interface ConnectionUnavailableError {
  code: 'connection_unavailable'
  message: string
}

export async function readSdkCredentialResult<T>(args: {
  connectorId: string
  toolConfig?: Record<string, unknown>
  userId: string
}): Promise<
  | { ok: true; credential: T }
  | {
      ok: false
      result: ToolFailure
    }
> {
  try {
    return {
      ok: true,
      credential: (await readConnectorCredential(args)) as T,
    }
  } catch (error) {
    if (isConnectionUnavailableError(error)) {
      return {
        ok: false,
        result: toolError('unavailable', error.message),
      }
    }
    throw error
  }
}

function isConnectionUnavailableError(
  error: unknown
): error is ConnectionUnavailableError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'connection_unavailable' &&
    'message' in error &&
    typeof error.message === 'string'
  )
}
