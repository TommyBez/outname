'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { requireUserId } from '@/auth/server/auth-guard'
import {
  buildOAuthClientAuthHeaders,
  readOAuthClientCredentials,
} from '@/connections/oauth-token-client'
import { getConnector } from '@/connections/registry'
import { readConnectorCredential } from '@/connections/runtime/credential'
import {
  disconnectConnection,
  persistApiKeyConnection,
} from '@/connections/runtime/store'
import type { StoredOAuth2CredentialBlob } from '@/connections/types'
import { userConnectionsTag } from '@/shared/server/cache-tags'

interface SaveApiKeyResult {
  error?: string
  ok: boolean
}

// Next.js Server Actions validate action ID and origin, so this form
// needs no separate CSRF token.
export async function saveApiKeyConnectionAction(
  connectorId: string,
  values: Record<string, string>
): Promise<SaveApiKeyResult> {
  const userId = await requireUserId()

  const connector = getConnector(connectorId)
  if (!connector) {
    return { ok: false, error: 'Unknown connector.' }
  }
  if (connector.authKind !== 'api_key') {
    return { ok: false, error: 'This connector does not accept API keys.' }
  }

  const parsed = connector.apiKey.formSchema.safeParse(values)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  if (connector.apiKey.validate) {
    try {
      const result = await connector.apiKey.validate(values)
      if (!result.ok) {
        return { ok: false, error: result.error ?? 'Invalid credentials.' }
      }
      await persistApiKeyConnection({
        userId,
        connectorId,
        raw: parsed.data,
        metadata: result.metadata ?? {},
      })
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Validation failed.',
      }
    }
  } else {
    await persistApiKeyConnection({
      userId,
      connectorId,
      raw: parsed.data,
      metadata: {},
    })
  }

  updateConnectionSurfaces(userId)
  return { ok: true }
}

export async function disconnectConnectionAction(connectorId: string) {
  const userId = await requireUserId()

  const connector = getConnector(connectorId)
  if (!connector) {
    return { ok: false, error: 'Unknown connector.' }
  }

  if (connector.authKind === 'oauth2') {
    await revokeOAuthConnection({ connectorId, userId }).catch((err) => {
      console.warn('disconnectConnectionAction: OAuth revoke failed', {
        connectorId,
        err,
      })
    })
  }
  await disconnectConnection({ userId, connectorId })
  updateConnectionSurfaces(userId)
  return { ok: true }
}

async function revokeOAuthConnection(input: {
  connectorId: string
  userId: string
}): Promise<void> {
  const connector = getConnector(input.connectorId)
  if (connector?.authKind !== 'oauth2' || !connector.oauth2.revokeUrl) {
    return
  }
  const result = await readConnectorCredential(input)
  const credential = result.credential as StoredOAuth2CredentialBlob
  const token = credential.refreshToken ?? credential.accessToken
  const client = readOAuthClientCredentials(connector)
  if (!client.ok) {
    return
  }
  const body = new URLSearchParams({
    token,
    client_id: client.credentials.clientId,
  })
  await fetch(connector.oauth2.revokeUrl, {
    body,
    headers: buildOAuthClientAuthHeaders(
      client.credentials.clientId,
      client.credentials.clientSecret
    ),
    method: 'POST',
  })
}

function updateConnectionSurfaces(userId: string): void {
  updateTag(userConnectionsTag(userId))
  revalidatePath('/connections')
}
