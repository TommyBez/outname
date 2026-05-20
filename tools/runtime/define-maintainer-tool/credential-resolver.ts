import 'server-only'

import {
  type ConnectorCredentialResult,
  credentialFingerprint,
  readConnectorCredential as readStoredConnectorCredential,
} from '@/connections/runtime/credential'
import type { RawCredential } from '@/connections/types'
import { readCredentialOverride } from './api-key-override'

export type ToolCredentialSource = 'connection' | 'override'

export interface ToolConnectorCredentialResult
  extends ConnectorCredentialResult {
  credentialSource: ToolCredentialSource
}

export async function readConnectorCredential(input: {
  connectorId: string
  toolConfig?: Record<string, unknown>
  userId: string
}): Promise<RawCredential> {
  const result = await readConnectorCredentialSnapshot(input)
  return result.credential
}

export async function readConnectorCredentialSnapshot(input: {
  connectorId: string
  toolConfig?: Record<string, unknown>
  userId: string
}): Promise<ToolConnectorCredentialResult> {
  const override = await readCredentialOverride({
    config: input.toolConfig,
    connectorId: input.connectorId,
  })
  if (override !== undefined) {
    return {
      credential: override,
      credentialSource: 'override',
      tokenFingerprint: await credentialFingerprint(override),
    }
  }

  const result = await readStoredConnectorCredential({
    connectorId: input.connectorId,
    userId: input.userId,
  })
  return { ...result, credentialSource: 'connection' }
}
